"""Schemas Pydantic (validação de entrada/saída da API)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Categorias do design system (espelham o frontend).
Category = Literal["casa", "filhos", "trabalho", "saude", "financas", "relacionamento"]

# Limite do plano gratuito (Freemium) — alinhado ao frontend.
FREE_TASK_LIMIT = 50


# ----------------------- User -----------------------
class UserBase(BaseModel):
    email: EmailStr
    name: str = "Você"


class UserCreate(UserBase):
    """Login/registro simplificado do MVP (sem senha/OAuth)."""


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_premium: bool
    created_at: datetime


# ----------------------- Task -----------------------
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    category: Category = "casa"
    due: str = Field("", max_length=120)
    important: bool = False


class TaskCreate(TaskBase):
    """Criação direta de tarefa (sem IA)."""


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    category: Category | None = None
    due: str | None = Field(None, max_length=120)
    important: bool | None = None
    done: bool | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    done: bool
    created_at: datetime


# ------------------- Tarefa Inteligente (IA) -------------------
class SmartTaskIn(BaseModel):
    """Entrada do endpoint /tasks/smart — texto em linguagem natural."""
    text: str = Field(..., min_length=1, max_length=1000)


class AiSuggestionAction(BaseModel):
    title: str
    category: Category = "casa"
    due: str = ""


class AiSuggestion(BaseModel):
    text: str
    action: AiSuggestionAction | None = None


class SmartTaskOut(BaseModel):
    """Saída compatível com o que o frontend (api.js) já consome.

    Por enquanto (sem IA), `subtasks` vem vazio e `suggestion` nulo.
    """
    title: str
    category: Category = "casa"
    due: str = ""
    subtasks: list[str] = []
    suggestion: AiSuggestion | None = None
    task: TaskOut | None = None  # a tarefa principal persistida
