"""Models do banco de dados."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="Você")
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    # Categoria do design system: casa | filhos | trabalho | saude | financas | relacionamento
    category: Mapped[str] = mapped_column(String(40), default="casa", nullable=False)
    # MVP: prazo em texto livre ("Hoje", "14:00", "Amanhã • 10:00"). Vira datetime depois.
    due: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    important: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="tasks")
