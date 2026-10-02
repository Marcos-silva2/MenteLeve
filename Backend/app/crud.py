"""Operações de banco de dados (camada CRUD)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, recurrence, schemas, security, spaces


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


# ----------------------- Tasks -----------------------
def member_space_ids(db: Session, user_id: int) -> list[int]:
    return list(db.scalars(select(models.SpaceMember.space_id).where(models.SpaceMember.user_id == user_id)))


def _visible(user_id: int):
    """Tarefas pessoais do usuário + as dos espaços de que ele participa.

    Tarefa de espaço NÃO entra só por ter sido criada por ele: quem sai do espaço
    deixa de ver até as que criou (ver `can_access_task`, a mesma regra).
    """
    mine = select(models.SpaceMember.space_id).where(models.SpaceMember.user_id == user_id)
    return or_(
        (models.Task.user_id == user_id) & models.Task.space_id.is_(None),
        models.Task.space_id.in_(mine),
    )


def can_access_task(db: Session, task: models.Task, user_id: int) -> bool:
    """Ver, editar e concluir: o criador ou qualquer membro do espaço da tarefa."""
    if task.user_id == user_id:
        # Quem saiu do espaço perde o acesso às tarefas que deixou lá.
        return task.space_id is None or is_member(db, task.space_id, user_id)
    return task.space_id is not None and is_member(db, task.space_id, user_id)


def can_delete_task(db: Session, task: models.Task, user_id: int) -> bool:
    """Apagar: só quem criou ou o dono do espaço (o resto pode editar e concluir)."""
    if not can_access_task(db, task, user_id):
        return False
    if task.space_id is None or task.user_id == user_id:
        return True
    space = db.get(models.Space, task.space_id)
    return space is not None and space.owner_id == user_id


def list_tasks(db: Session, user_id: int) -> list[models.Task]:
    stmt = (
        select(models.Task)
        .where(_visible(user_id))
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
        .where(_visible(user_id), models.Task.done.is_(False))
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
    values = data.model_dump()
    if data.parent_id is not None:
        # A subtarefa vive no mesmo espaço da mãe (e só pode ser criada por quem a enxerga).
        parent = db.get(models.Task, data.parent_id)
        if parent is not None and can_access_task(db, parent, user_id):
            values["space_id"] = parent.space_id
    task = models.Task(user_id=user_id, **values)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: models.Task, data: schemas.TaskUpdate) -> models.Task:
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(task, field, value)
    rec_fields = ("is_recurring", "recurrence_pattern", "recurrence_weekdays", "recurrence_until")
    if any(f in changes for f in rec_fields):
        if changes.get("recurrence_weekdays") and "recurrence_pattern" not in changes:
            task.recurrence_pattern = "weekly"
        if task.recurrence_pattern != "weekly":
            task.recurrence_weekdays = None
        # Mantém os dois campos coerentes, como o TaskBase faz na criação:
        # desligar limpa o padrão; informar só o padrão liga a recorrência; ligar
        # sem nenhum padrão (nem antes) não faz sentido e volta a desligado.
        if changes.get("is_recurring") is False:
            task.recurrence_pattern = None
        elif task.recurrence_pattern is not None:
            task.is_recurring = True
        if task.is_recurring and task.recurrence_pattern is None:
            task.is_recurring = False
        if not task.is_recurring:
            task.recurrence_weekdays = None
            task.recurrence_until = None
    if "due_time" in changes or "end_time" in changes:
        # Sem início, ou com o fim antes do início, a duração deixa de valer.
        if task.end_time and (not task.due_time or task.end_time <= task.due_time):
            task.end_time = None
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
    nxt = None
    if done and task.is_recurring and task.recurrence_pattern:
        nxt = recurrence.next_occurrence(
            task.due_date, task.recurrence_pattern, today or date.today(),
            task.recurrence_weekdays, task.recurrence_until,
        )
    if nxt is not None:
        task.due_date = nxt
        task.done = False
        # O lembrete push já enviado valia para o ciclo que acabou.
        task.reminder_sent_at = None
    else:
        # Não recorrente, reabrindo, ou série encerrada (passou de recurrence_until).
        task.done = done
    db.commit()
    db.refresh(task)
    return task


# ----------------------- Espaços compartilhados -----------------------
def is_member(db: Session, space_id: int, user_id: int) -> bool:
    return db.get(models.SpaceMember, (space_id, user_id)) is not None


def get_space(db: Session, space_id: int) -> models.Space | None:
    return db.get(models.Space, space_id)


def get_space_by_code(db: Session, code: str) -> models.Space | None:
    return db.scalar(select(models.Space).where(models.Space.invite_code == spaces.normalize_code(code)))


def list_spaces(db: Session, user_id: int) -> list[models.Space]:
    ids = select(models.SpaceMember.space_id).where(models.SpaceMember.user_id == user_id)
    return list(db.scalars(select(models.Space).where(models.Space.id.in_(ids)).order_by(models.Space.created_at)))


def create_space(db: Session, owner_id: int, name: str) -> models.Space:
    for _ in range(5):   # colisão de código é praticamente impossível; a repetição é só rede de segurança
        code = spaces.new_invite_code()
        if get_space_by_code(db, code) is None:
            break
    space = models.Space(name=name, invite_code=code, owner_id=owner_id)
    space.members.append(models.SpaceMember(user_id=owner_id))
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


def add_member(db: Session, space: models.Space, user_id: int) -> None:
    db.add(models.SpaceMember(space_id=space.id, user_id=user_id))
    db.commit()
    db.refresh(space)


def remove_member(db: Session, space: models.Space, user_id: int) -> None:
    """Tira o usuário do espaço. Sem membros, o espaço e as tarefas dele são apagados;
    se quem saiu era o dono, o dono passa a ser o membro mais antigo."""
    member = db.get(models.SpaceMember, (space.id, user_id))
    if member is not None:
        db.delete(member)
        db.commit()
        db.refresh(space)
    if not space.members:
        db.execute(delete(models.Task).where(models.Task.space_id == space.id))
        db.delete(space)
        db.commit()
        return
    if space.owner_id == user_id:
        space.owner_id = space.members[0].user_id
        db.commit()


def reset_invite_code(db: Session, space: models.Space) -> models.Space:
    while True:
        code = spaces.new_invite_code()
        if get_space_by_code(db, code) is None:
            break
    space.invite_code = code
    db.commit()
    db.refresh(space)
    return space


def reminder_recipients(db: Session, task: models.Task) -> list[int]:
    """Quem recebe o lembrete push: o criador, ou todos os membros se for de um espaço."""
    if task.space_id is None:
        return [task.user_id]
    return list(db.scalars(select(models.SpaceMember.user_id).where(models.SpaceMember.space_id == task.space_id)))


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
