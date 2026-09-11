"""Operações de banco de dados (camada CRUD)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas, security


# ----------------------- Users -----------------------
def get_user(db: Session, user_id: int) -> models.User | None:
    return db.get(models.User, user_id)


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.scalar(select(models.User).where(models.User.email == email))


def create_user(db: Session, data: schemas.UserCreate) -> models.User | None:
    """Cria o usuário com a senha hasheada.

    Retorna None se o e-mail já estiver em uso. O `IntegrityError` é tratado
    porque duas requisições simultâneas com o mesmo e-mail passariam pela
    verificação prévia e só colidiriam no INSERT.
    """
    user = models.User(
        email=data.email,
        name=data.name or "Você",
        hashed_password=security.hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> models.User | None:
    """Valida e-mail + senha. Retorna None em qualquer falha."""
    user = get_user_by_email(db, email)
    if user is None or not user.hashed_password:
        # Gasta o mesmo tempo de um verify real: sem isso, a diferença de
        # latência revelaria quais e-mails têm conta cadastrada.
        security.dummy_verify()
        return None
    if not security.verify_password(password, user.hashed_password):
        return None
    return user


def set_user_premium(db: Session, user: models.User, is_premium: bool) -> models.User:
    user.is_premium = is_premium
    db.commit()
    db.refresh(user)
    return user


# ----------------------- Tasks -----------------------
def list_tasks(db: Session, user_id: int) -> list[models.Task]:
    stmt = (
        select(models.Task)
        .where(models.Task.user_id == user_id)
        .order_by(models.Task.done.asc(), models.Task.created_at.desc())
    )
    return list(db.scalars(stmt))


def count_tasks(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(models.Task).where(models.Task.user_id == user_id)
    ) or 0


def get_task(db: Session, task_id: int) -> models.Task | None:
    return db.get(models.Task, task_id)


def list_open_tasks(db: Session, user_id: int) -> list[models.Task]:
    """Tarefas em aberto — usadas para casar o título dito no chat da Bruna."""
    stmt = (
        select(models.Task)
        .where(models.Task.user_id == user_id, models.Task.done.is_(False))
        .order_by(models.Task.created_at.desc())
    )
    return list(db.scalars(stmt))


def find_recent_duplicate(
    db: Session, user_id: int, title: str, due_date: date | None, within_minutes: int = 5
) -> models.Task | None:
    """Procura uma tarefa igual criada há pouco.

    O chat pode ser reenviado pela usuária quando a resposta demora (o timeout do
    cliente não cancela a requisição em andamento), e sem isso ela ganharia uma
    tarefa duplicada. Checar no banco — e não em memória — sobrevive ao restart
    do Render.

    O título é comparado **em Python**, não no SQL: a coluna é criptografada
    (ver crypto.EncryptedText) e um `WHERE title = ...` compararia contra o
    ciphertext, que nunca casa — a proteção morreria em silêncio. O conjunto
    filtrado no banco já é pequeno (mesma usuária, em aberto, últimos minutos).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=within_minutes)
    normalized = title.strip().lower()
    stmt = select(models.Task).where(
        models.Task.user_id == user_id,
        models.Task.done.is_(False),
        models.Task.created_at >= cutoff,
    )
    for task in db.scalars(stmt):
        if task.title.strip().lower() == normalized and task.due_date == due_date:
            return task
    return None


def create_task(db: Session, user_id: int, data: schemas.TaskCreate) -> models.Task:
    task = models.Task(user_id=user_id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: models.Task, data: schemas.TaskUpdate) -> models.Task:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def set_task_done(db: Session, task: models.Task, done: bool) -> models.Task:
    task.done = done
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: models.Task) -> None:
    # Subtarefas (filhas) são removidas pelo ON DELETE CASCADE do banco
    # (FK de tasks.parent_id) — ver database.py para o equivalente no SQLite.
    db.delete(task)
    db.commit()


def tasks_due_for_reminder(
    db: Session, today: date, not_before: str, not_after: str
) -> list[models.Task]:
    """Tarefas em aberto, com horário definido, vencendo dentro da janela e sem
    lembrete enviado ainda. `due_time` é "HH:MM" (zero-padded): comparar como
    string funciona porque a ordem lexicográfica coincide com a cronológica.
    """
    stmt = select(models.Task).where(
        models.Task.done.is_(False),
        models.Task.due_date == today,
        models.Task.due_time.isnot(None),
        models.Task.due_time >= not_before,
        models.Task.due_time <= not_after,
        models.Task.reminder_sent_at.is_(None),
    )
    return list(db.scalars(stmt))


def mark_reminder_sent(db: Session, task: models.Task) -> None:
    task.reminder_sent_at = datetime.now(timezone.utc)
    db.commit()


# ----------------------- Push subscriptions -----------------------
def upsert_push_subscription(
    db: Session, user_id: int, endpoint: str, p256dh: str, auth: str
) -> models.PushSubscription:
    """Grava a inscrição; se o `endpoint` já existir (reassinatura, ou troca de
    conta no mesmo aparelho), atualiza no lugar de duplicar — `endpoint` é único.
    """
    existing = db.scalar(
        select(models.PushSubscription).where(models.PushSubscription.endpoint == endpoint)
    )
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
        db.commit()
        db.refresh(existing)
        return existing

    sub = models.PushSubscription(user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def list_push_subscriptions(db: Session, user_id: int) -> list[models.PushSubscription]:
    stmt = select(models.PushSubscription).where(models.PushSubscription.user_id == user_id)
    return list(db.scalars(stmt))


def delete_push_subscription(db: Session, user_id: int, endpoint: str) -> bool:
    sub = db.scalar(
        select(models.PushSubscription).where(
            models.PushSubscription.user_id == user_id,
            models.PushSubscription.endpoint == endpoint,
        )
    )
    if sub is None:
        return False
    db.delete(sub)
    db.commit()
    return True


def delete_push_subscription_by_endpoint(db: Session, endpoint: str) -> None:
    """Usado quando o provedor de push diz que o endpoint não existe mais
    (410/404) — a inscrição está morta independente de quem a possui."""
    db.execute(
        models.PushSubscription.__table__.delete().where(
            models.PushSubscription.endpoint == endpoint
        )
    )
    db.commit()
