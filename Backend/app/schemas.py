"""Schemas Pydantic (validação de entrada/saída da API)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Categorias do design system (espelham o frontend).
Category = Literal["casa", "filhos", "trabalho", "saude", "financas", "relacionamento"]

# Horário no formato "HH:MM" (24h).
TimeStr = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]

# Limite do plano gratuito (Freemium) — alinhado ao frontend.
FREE_TASK_LIMIT = 50


# ----------------------- User -----------------------
class UserBase(BaseModel):
    email: EmailStr
    name: str = "Você"


# Mínimo de 6 caracteres — espelha a validação que o frontend já faz.
Password = Annotated[str, Field(min_length=6, max_length=128)]


class UserCreate(UserBase):
    """Cadastro: e-mail, nome e senha."""

    password: Password


class UserLogin(BaseModel):
    """Login: e-mail e senha."""

    email: EmailStr
    password: Password


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_premium: bool
    created_at: datetime


class TokenOut(BaseModel):
    """Resposta de /auth/register e /auth/login."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ----------------------- Task -----------------------
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    category: Category = "casa"
    # Prazo estruturado — fonte da verdade para o calendário.
    due_date: date | None = None
    due_time: TimeStr | None = None
    # Rótulo livre; hoje só fallback de exibição (ver models.Task.due).
    due: str = Field("", max_length=120)
    important: bool = False
    # Subtarefa: id da tarefa-mãe (None = tarefa principal).
    parent_id: int | None = None


class TaskCreate(TaskBase):
    """Criação direta de tarefa (sem IA)."""


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    category: Category | None = None
    due_date: date | None = None
    due_time: TimeStr | None = None
    due: str | None = Field(None, max_length=120)
    important: bool | None = None
    done: bool | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    done: bool
    created_at: datetime


# ------------------- Chat com a IA (Bruna) -------------------
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=40)
    # Data local da usuária — mesmo motivo de fuso do SmartTaskIn.
    today: date | None = None


class ChatOut(BaseModel):
    reply: str
    # Tarefas criadas/concluídas pela Bruna nesta resposta. O frontend atualiza
    # essas por id (nunca recarrega a lista toda: isso apagaria tarefas criadas
    # offline e rebaixaria a prioridade, que o backend não persiste).
    tasks: list[TaskOut] = []
    # True quando a criação esbarrou no limite do plano gratuito.
    limite_atingido: bool = False


# ------------------- Tarefa Inteligente (IA) -------------------
class SmartTaskIn(BaseModel):
    """Entrada do endpoint /tasks/smart — texto em linguagem natural."""
    text: str = Field(..., min_length=1, max_length=1000)
    # Data local da usuária (o servidor roda em UTC; entre 21h e 00h no Brasil
    # o "hoje" do servidor já é o dia seguinte, e "amanhã" viraria +2 dias).
    today: date | None = None


class AiSuggestionAction(BaseModel):
    title: str
    category: Category = "casa"
    due_date: date | None = None
    due_time: TimeStr | None = None
    due: str = ""


class AiSuggestion(BaseModel):
    text: str
    action: AiSuggestionAction | None = None


class SmartTaskOut(BaseModel):
    """Saída compatível com o que o frontend (api.js) já consome.

    Sem IA configurada, `subtasks` vem vazio e `suggestion` nulo.
    """
    title: str
    category: Category = "casa"
    due_date: date | None = None
    due_time: TimeStr | None = None
    due: str = ""
    subtasks: list[str] = []
    suggestion: AiSuggestion | None = None
    task: TaskOut | None = None  # a tarefa principal persistida
    # A IA respondeu de verdade, ou isto é o fallback do servidor?
    # Sem este campo a resposta degradada (título normalizado, categoria "casa",
    # sem data) chega ao frontend indistinguível de uma análise real — e o
    # cliente, vendo um objeto válido, deixa de usar a própria heurística, que
    # ao menos extrai data e categoria do texto. Ver Frontend/js/api.js.
    ai: bool = True
