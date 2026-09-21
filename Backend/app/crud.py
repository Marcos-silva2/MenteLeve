"""Operações de banco de dados (camada CRUD)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, recurrence, schemas, security
from app.config import settings


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


# ----------------------- Recuperação de senha -----------------------
def _as_utc(dt: datetime) -> datetime:
    """O SQLite devolve datetimes sem fuso mesmo em colunas timezone-aware; o
    Postgres devolve com fuso. Normaliza para poder comparar nos dois."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def create_password_reset_token(db: Session, user: models.User) -> str:
    """Gera um token de recuperação e devolve o valor ORIGINAL (para o e-mail).

    Só o hash vai para o banco. Pedidos anteriores ainda pendentes são
    invalidados: vale sempre o link mais recente, e uma caixa de entrada com três
    links antigos não vira três chaves da conta.
    """
    now = datetime.now(timezone.utc)
    db.execute(
        update(models.PasswordResetToken)
        .where(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    raw = security.new_reset_token()
    db.add(
        models.PasswordResetToken(
            user_id=user.id,
            token_hash=security.hash_reset_token(raw),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_MINUTES),
        )
    )
    db.commit()
    return raw


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> models.User | None:
    """Troca a senha se o token for válido. Devolve o usuário, ou None.

    None cobre, sem distinguir (de propósito): token inexistente, expirado ou já
    usado. Distinguir diria a quem chuta tokens qual deles já existiu.

    O consumo é atômico (`UPDATE ... WHERE used_at IS NULL`): dois pedidos
    simultâneos com o mesmo link não passam os dois pela verificação prévia.
    """
    now = datetime.now(timezone.utc)
    row = db.scalar(
        select(models.PasswordResetToken).where(
            models.PasswordResetToken.token_hash == security.hash_reset_token(raw_token)
        )
    )
    if row is None or row.used_at is not None or _as_utc(row.expires_at) <= now:
        return None

    consumed = db.execute(
        update(models.PasswordResetToken)
        .where(models.PasswordResetToken.id == row.id, models.PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    if consumed.rowcount != 1:
        db.rollback()
        return None

    user = db.get(models.User, row.user_id)
    if user is None:
        db.rollback()
        return None

    user.hashed_password = security.hash_password(new_password)
    # Derruba toda sessão anterior (JWT emitido com a versão antiga).
    user.token_version = (user.token_version or 0) + 1
    # Qualquer outro link pendente da conta morre junto.
    db.execute(
        update(models.PasswordResetToken)
        .where(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
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
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(task, field, value)
    if "is_recurring" in changes or "recurrence_pattern" in changes:
        # Mantém os dois campos coerentes, como o TaskBase faz na criação:
        # desligar limpa o padrão; informar só o padrão liga a recorrência; ligar
        # sem nenhum padrão (nem antes) não faz sentido e volta a desligado.
        if changes.get("is_recurring") is False:
            task.recurrence_pattern = None
        elif task.recurrence_pattern is not None:
            task.is_recurring = True
        if task.is_recurring and task.recurrence_pattern is None:
            task.is_recurring = False
    if "due_date" in changes or "due_time" in changes:
        # Reagendou: um lembrete já enviado valia para o horário antigo. Sem
        # zerar aqui, adiar uma tarefa depois do lembrete sair nunca mais
        # dispararia nada para o novo horário.
        task.reminder_sent_at = None
    db.commit()
    db.refresh(task)
    return task


def set_task_done(
    db: Session, task: models.Task, done: bool, today: date | None = None
) -> models.Task:
    """Conclui/reabre a tarefa.

    Tarefa recorrente NÃO fecha ao concluir: o prazo rola para a próxima
    ocorrência e ela segue em aberto (ver app/recurrence.py para o porquê — evita
    duplicatas entre o aparelho e o servidor). `today` é a data local da usuária.
    """
    if done and task.is_recurring and task.recurrence_pattern:
        task.due_date = recurrence.next_occurrence(
            task.due_date, task.recurrence_pattern, today or date.today()
        )
        task.done = False
        # O lembrete push já enviado valia para o ciclo que acabou.
        task.reminder_sent_at = None
    else:
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
    db: Session, start: datetime, end: datetime
) -> list[models.Task]:
    """Tarefas-mãe em aberto, com horário definido, vencendo dentro de
    [start, end] e sem lembrete enviado ainda.

    `start`/`end` são datetimes ingênuos (sem tzinfo) em hora local — mesmo
    fuso assumido por `due_date`/`due_time` em todo o resto do app (ver
    routers/push.py). A janela é comparada em PYTHON, não em SQL: due_date e
    due_time são colunas separadas (data + "HH:MM" em texto), e uma janela
    pode atravessar a virada do dia (23:55 -> 00:05) — expressar isso como
    comparação de string em SQL dava um intervalo vazio nesse caso. Juntar os
    dois campos após um pré-filtro de data no banco é mais simples e correto;
    o volume por usuária é pequeno (FREE_TASK_LIMIT), então filtrar em Python
    não pesa.

    Só tarefas-mãe (`parent_id is None`): as subtarefas sugeridas pela IA
    herdam a mesma data/hora da tarefa que as gerou, então sem este filtro a
    varredura mandaria uma notificação por subtarefa além da própria tarefa —
    várias notificações para um único compromisso.
    """
    stmt = select(models.Task).where(
        models.Task.done.is_(False),
        models.Task.parent_id.is_(None),
        models.Task.due_date >= start.date(),
        models.Task.due_date <= end.date(),
        models.Task.due_time.isnot(None),
        models.Task.reminder_sent_at.is_(None),
    )
    out = []
    for task in db.scalars(stmt):
        hh, mm = task.due_time.split(":")
        task_dt = datetime(task.due_date.year, task.due_date.month, task.due_date.day, int(hh), int(mm))
        if start <= task_dt <= end:
            out.append(task)
    return out


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
