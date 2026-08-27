"""Models do banco de dados."""
from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="Você")
    # Hash bcrypt da senha. Nullable por causa da micro-migração aditiva
    # (ver database.py): contas antigas sem senha não conseguem logar.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    # Prazo estruturado — fonte da verdade para posicionar a tarefa no calendário.
    due_date: Mapped[dt_date | None] = mapped_column(Date, nullable=True, index=True)
    due_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    # Rótulo em texto livre ("Toda semana", "Véspera"). Hoje é apenas fallback de
    # exibição: vale para linhas antigas e para prazos sem uma data única.
    due: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    important: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="tasks")
