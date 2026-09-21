"""Models do banco de dados."""
from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.crypto import EncryptedText
from app.database import Base


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
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Versão da sessão. Vai dentro do JWT (claim `tv`) e é conferida a cada
    # requisição; incrementá-la invalida todos os tokens já emitidos (ex.: após
    # redefinir a senha). Contas antigas começam em 0, igual aos tokens antigos
    # que não têm o claim — ver security.decode_token.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Task.created_at.desc()",
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

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
    # Categoria do design system: casa | filhos | trabalho | saude | financas | relacionamento
    category: Mapped[str] = mapped_column(String(40), default="casa", nullable=False)
    # Prazo estruturado — fonte da verdade para posicionar a tarefa no calendário.
    due_date: Mapped[dt_date | None] = mapped_column(Date, nullable=True, index=True)
    due_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Quando o lembrete push desta tarefa foi enviado (None = ainda não). Evita
    # reenviar a cada rodada da varredura — ver app/push.py.
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="tasks")


class PasswordResetToken(Base):
    """Token de recuperação de senha (uso único, com validade).

    Só o SHA-256 do token é guardado: quem lê o banco não consegue redefinir a
    senha de ninguém. SHA-256 (e não bcrypt) basta porque o token tem 256 bits de
    entropia — não há o que adivinhar por força bruta, e a consulta precisa ser
    por igualdade no índice.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


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
