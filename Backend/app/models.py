"""Models do banco de dados."""
from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.categories import DEFAULT_CATEGORY
from app.crypto import EncryptedText
from app.database import Base


class WeekdayList(TypeDecorator):
    """Lista de dias da semana [0, 2, 4] guardada como "0,2,4" (0 = segunda)."""

    impl = String(20)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return ",".join(str(int(v)) for v in value) if value else None

    def process_result_value(self, value, dialect):
        return [int(v) for v in value.split(",") if v.strip()] if value else None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # E-mail fica em texto puro de propósito: é a chave de busca do login
    # (`WHERE email = ?`) e tem índice UNIQUE. Com nonce aleatório, o mesmo
    # e-mail geraria valores diferentes e as duas coisas quebrariam.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(EncryptedText, nullable=False, default="Você")
    # Hash bcrypt da senha. Nullable por causa da micro-migração aditiva
    # (ver database.py): contas antigas sem senha não conseguem logar.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Task.created_at.desc()",
    )


class Space(Base):
    """Espaço compartilhado: uma lista de tarefas comum a vários usuários.

    Entra-se por um código de convite. Todos os membros veem e editam as tarefas do
    espaço; apagar fica com quem criou a tarefa ou com o dono (ver crud.can_delete_task).
    """

    __tablename__ = "spaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Criptografado como o título das tarefas: o nome de uma equipe também é conteúdo.
    name: Mapped[str] = mapped_column(EncryptedText, nullable=False)
    # Sem hífen, em maiúsculas (ver app/spaces.py). Único: é o que identifica o espaço no convite.
    invite_code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    members: Mapped[list["SpaceMember"]] = relationship(
        back_populates="space", cascade="all, delete-orphan", order_by="SpaceMember.joined_at"
    )


class SpaceMember(Base):
    __tablename__ = "space_members"

    space_id: Mapped[int] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    space: Mapped["Space"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # Espaço compartilhado (NULL = tarefa pessoal). Quem criou continua em `user_id`.
    space_id: Mapped[int | None] = mapped_column(
        ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Subtarefa: aponta para a tarefa-mãe (NULL = tarefa principal).
    # As sugestões da IA são fixadas como subtarefas da tarefa do usuário.
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Criptografado no banco (AES-256-GCM) — é o conteúdo sensível da usuária.
    # Consequência: não dá para comparar/ordenar título em SQL. Ver crypto.py.
    title: Mapped[str] = mapped_column(EncryptedText, nullable=False)
    # Metadados ficam em texto puro: são eles que sustentam o calendário e os
    # índices (ix_tasks_due_date). Revelam quando, não o quê.
    # Categoria (ver app/categories.py)
    category: Mapped[str] = mapped_column(String(40), default=DEFAULT_CATEGORY, nullable=False)
    # Prazo estruturado — fonte da verdade para posicionar a tarefa no calendário.
    due_date: Mapped[dt_date | None] = mapped_column(Date, nullable=True, index=True)
    due_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    # Fim do bloco de tempo ("HH:MM", mesmo dia, depois de due_time). NULL = sem duração.
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    # Rótulo em texto livre ("Toda semana", "Véspera"). Hoje é apenas fallback de
    # exibição: vale para linhas antigas e para prazos sem uma data única.
    due: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    important: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Recorrência: ao concluir, a tarefa não fecha — o prazo avança para a
    # próxima ocorrência (ver app/recurrence.py e crud.set_task_done).
    # `recurrence_pattern`: daily | weekly | monthly (NULL quando não recorrente).
    is_recurring: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    recurrence_pattern: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Só para weekly: dias específicos (ex.: dias úteis). NULL = toda semana no dia do prazo.
    recurrence_weekdays: Mapped[list[int] | None] = mapped_column(WeekdayList, nullable=True)
    # Último dia da série. Concluir depois disso fecha a tarefa de vez.
    recurrence_until: Mapped[dt_date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Quando o lembrete push desta tarefa foi enviado (None = ainda não). Evita
    # reenviar a cada rodada da varredura — ver app/push.py.
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="tasks")

    @property
    def author_name(self) -> str | None:
        """Quem criou — só interessa nas tarefas compartilhadas."""
        return self.user.name if self.space_id is not None and self.user is not None else None


class PushSubscription(Base):
    """Uma inscrição de notificação push (um navegador/aparelho instalado).

    Uma usuária pode ter mais de uma (celular + desktop instalado); o `endpoint`
    identifica o par navegador+serviço de push e é único por natureza — é o que
    permite reassinar sem duplicar linha (ver crud.upsert_push_subscription).
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    # Chaves públicas da assinatura (fornecidas pelo navegador), necessárias
    # para cifrar o payload do Web Push — não são segredo do servidor.
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
