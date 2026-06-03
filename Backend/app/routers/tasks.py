"""Rotas de tarefas (CRUD + criação inteligente)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Task, User
from app.schemas import FREE_TASK_LIMIT

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_owned_task(task_id: int, user: User, db: Session) -> Task:
    """Recupera a tarefa garantindo que pertence ao usuário autenticado."""
    task = crud.get_task(db, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")
    return task


def _enforce_free_limit(user: User, db: Session) -> None:
    """Bloqueia a criação além do limite gratuito (gatilho do Paywall)."""
    if user.is_premium:
        return
    if crud.count_tasks(db, user.id) >= FREE_TASK_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Limite gratuito de {FREE_TASK_LIMIT} tarefas atingido. Faça upgrade para o Premium.",
        )


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return crud.list_tasks(db, user.id)


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    data: schemas.TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _enforce_free_limit(user, db)
    return crud.create_task(db, user.id, data)


@router.post("/smart", response_model=schemas.SmartTaskOut, status_code=status.HTTP_201_CREATED)
def create_smart_task(
    data: schemas.SmartTaskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Criação a partir de texto em linguagem natural.

    NOTA: a Inteligência Artificial ainda NÃO está plugada. Por ora, esta rota
    apenas persiste a tarefa com o texto recebido e devolve o formato que o
    frontend espera (com `subtasks` vazio e `suggestion` nulo).

    TODO(IA): chamar o provedor (Google AI Studio) para:
      - normalizar título, extrair data/hora (NLP) e categoria;
      - sugerir subtarefas e um lembrete preventivo (o "Aha Moment").
    """
    _enforce_free_limit(user, db)

    title = data.text.strip()
    title = title[0].upper() + title[1:] if title else title

    task = crud.create_task(
        db,
        user.id,
        schemas.TaskCreate(title=title, category="casa", due=""),
    )

    return schemas.SmartTaskOut(
        title=task.title,
        category=task.category,
        due=task.due,
        subtasks=[],        # IA preencherá depois
        suggestion=None,    # IA preencherá depois
        task=task,
    )


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    data: schemas.TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, user, db)
    return crud.update_task(db, task, data)


@router.put("/{task_id}/complete", response_model=schemas.TaskOut)
def complete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, user, db)
    return crud.set_task_done(db, task, True)


@router.put("/{task_id}/uncomplete", response_model=schemas.TaskOut)
def uncomplete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, user, db)
    return crud.set_task_done(db, task, False)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, user, db)
    crud.delete_task(db, task)
