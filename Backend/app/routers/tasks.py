"""Rotas de tarefas (CRUD + criação inteligente)."""
from __future__ import annotations

import asyncio
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import ai, crud, recurrence, schemas
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


@router.post("/smart", response_model=schemas.SmartTaskOut)
async def analyze_smart_task(
    data: schemas.SmartTaskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analisa um texto em linguagem natural com a IA (o "Aha Moment").

    Esta rota NÃO persiste a tarefa: ela apenas normaliza o título, extrai
    data/categoria (NLP) e sugere subtarefas + um lembrete preventivo. O
    frontend usa o resultado para criar a(s) tarefa(s) via `POST /tasks`,
    preservando as escolhas manuais da usuária.

    Sem `GOOGLE_AI_API_KEY` configurada (ou em caso de falha da IA), devolve
    um fallback que apenas normaliza o título.

    `async`: a chamada à IA (ai.analyze) é assíncrona (ver app/ai.py) para não
    prender uma thread do pool durante a espera de rede. `_enforce_free_limit`
    continua síncrona (SQLAlchemy não é assíncrono aqui) — vai para uma thread
    à parte via `asyncio.to_thread` para não bloquear o event loop.
    """
    await asyncio.to_thread(_enforce_free_limit, user, db)

    result = await ai.analyze(data.text, today=data.today)

    if result is None:
        # Fallback do servidor: só normaliza o título. `ai=False` avisa o cliente
        # de que ninguém analisou nada, para que ele aplique a heurística local
        # em vez de aceitar "casa, sem data" como se fosse um palpite.
        # A recorrência, porém, é detectada por regra (sem IA) e segue na resposta.
        title = data.text.strip()
        title = title[0].upper() + title[1:] if title else title
        pattern = recurrence.detect_recurrence(data.text)
        return schemas.SmartTaskOut(
            title=title,
            category="casa",
            is_recurring=pattern is not None,
            recurrence_pattern=pattern,
            ai=False,
        )

    return schemas.SmartTaskOut(
        title=result["title"],
        category=result["category"],
        due_date=result["due_date"],
        due_time=result["due_time"],
        due=result["due"],
        is_recurring=result["is_recurring"],
        recurrence_pattern=result["recurrence_pattern"],
        subtasks=result["subtasks"],
        suggestion=result["suggestion"],
        ai=True,
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
    # Data local da usuária (o servidor roda em UTC). Só importa para tarefas
    # recorrentes, que rolam o prazo para a próxima ocorrência ao concluir.
    today: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, user, db)
    return crud.set_task_done(db, task, True, today=today)


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
