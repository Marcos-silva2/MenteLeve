"""Operações de banco de dados (camada CRUD)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas


# ----------------------- Users -----------------------
def get_user(db: Session, user_id: int) -> models.User | None:
    return db.get(models.User, user_id)


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.scalar(select(models.User).where(models.User.email == email))


def get_or_create_user(db: Session, data: schemas.UserCreate) -> models.User:
    """Login/registro do MVP: identifica por e-mail; cria se não existir."""
    user = get_user_by_email(db, data.email)
    if user:
        # mantém o nome atualizado se vier preenchido
        if data.name and data.name != user.name:
            user.name = data.name
            db.commit()
            db.refresh(user)
        return user

    user = models.User(email=data.email, name=data.name or "Você")
    db.add(user)
    db.commit()
    db.refresh(user)
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
    # Remove também as subtarefas (filhos) — cascade explícito (SQLite confiável).
    children = db.scalars(
        select(models.Task).where(models.Task.parent_id == task.id)
    ).all()
    for child in children:
        db.delete(child)
    db.delete(task)
    db.commit()
