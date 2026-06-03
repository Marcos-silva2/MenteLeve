"""Configuração do banco de dados (SQLAlchemy + SQLite)."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# `check_same_thread=False` é necessário para o SQLite funcionar com o FastAPI,
# que pode acessar a sessão a partir de threads diferentes.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarativa para os models."""


def get_db() -> Generator[Session, None, None]:
    """Dependency do FastAPI: fornece uma sessão e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Cria as tabelas (MVP: sem migrações; Alembic pode entrar depois)."""
    # importa os models para registrá-los no metadata antes do create_all
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
