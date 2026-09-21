"""Schemas Pydantic (validação de entrada/saída da API)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# Categorias do design system (espelham o frontend).
Category = Literal["casa", "filhos", "trabalho", "saude", "financas", "relacionamento"]

# Horário no formato "HH:MM" (24h).
TimeStr = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]

# Recorrência de tarefas (ver app/recurrence.py).
RecurrencePattern = Literal["daily", "weekly", "monthly"]

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
    # Recorrência. `is_recurring` e `recurrence_pattern` andam juntos: o
    # validador abaixo os mantém coerentes (nunca "recorrente sem padrão").
    is_recurring: bool = False
    recurrence_pattern: RecurrencePattern | None = None

    @model_validator(mode="after")
    def _recorrencia_coerente(self) -> "TaskBase":
        # Só o padrão informado: entende como recorrente (o cliente pode omitir a flag).
        if self.recurrence_pattern is not None and not self.is_recurring:
            self.is_recurring = True
        if self.is_recurring and self.recurrence_pattern is None:
            raise ValueError("Informe recurrence_pattern (daily, weekly ou monthly).")
        return self


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
    is_recurring: bool | None = None
    recurrence_pattern: RecurrencePattern | None = None


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
    # Recorrência detectada ("todo dia", "toda segunda"…). O cliente repassa
    # estes campos ao criar a tarefa via POST /tasks.
    is_recurring: bool = False
    recurrence_pattern: RecurrencePattern | None = None
    subtasks: list[str] = []
    suggestion: AiSuggestion | None = None
    task: TaskOut | None = None  # a tarefa principal persistida
    # A IA respondeu de verdade, ou isto é o fallback do servidor?
    # Sem este campo a resposta degradada (título normalizado, categoria "casa",
    # sem data) chega ao frontend indistinguível de uma análise real — e o
    # cliente, vendo um objeto válido, deixa de usar a própria heurística, que
    # ao menos extrai data e categoria do texto. Ver Frontend/js/api.js.
    ai: bool = True


# ------------------- Notificações push -------------------
# Hosts reais de serviço de push por navegador — usado para validar o
# `endpoint` recebido em PushSubscriptionIn (ver o validador abaixo).
_ALLOWED_PUSH_HOSTS = (
    "fcm.googleapis.com",       # Chrome/Edge/Android
    "android.googleapis.com",   # FCM legado
    "web.push.apple.com",       # Safari/iOS
    "notify.windows.com",       # Edge legado
    "updates.push.services.mozilla.com",  # Firefox
)


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    """Espelha o formato de `PushSubscription.toJSON()` do navegador."""

    endpoint: str = Field(..., max_length=500)
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def _endpoint_deve_ser_servico_de_push_conhecido(cls, v: str) -> str:
        """Restringe a HTTPS + um host de push real.

        Sem isso, qualquer usuária autenticada poderia gravar aqui uma URL
        arbitrária (um IP interno, por exemplo) e o servidor passaria a fazer
        POST nesse endereço a cada varredura (app/push.py). A resposta nunca
        volta pra quem cadastrou — é cego — mas ainda é uma requisição de
        saída do servidor controlada por entrada de quem só devia poder
        cadastrar o próprio navegador.
        """
        host = (urlparse(v).hostname or "").lower()
        scheme_ok = v.startswith("https://")
        host_ok = any(host == h or host.endswith(f".{h}") for h in _ALLOWED_PUSH_HOSTS)
        if not (scheme_ok and host_ok):
            raise ValueError("Endpoint de push não reconhecido.")
        return v


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(..., max_length=500)


class PushPublicKeyOut(BaseModel):
    public_key: str = ""
    enabled: bool = False
