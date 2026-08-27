"""Configuração do banco de dados (SQLAlchemy + SQLite)."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# `check_same_thread=False` é necessário para o SQLite funcionar com o FastAPI,
# que pode acessar a sessão a partir de threads diferentes.
connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if _is_sqlite:
    # SQLite não aplica FOREIGN KEY / ON DELETE CASCADE por padrão (ao contrário
    # do Postgres). Habilita para que o comportamento de cascade seja o mesmo
    # nos dois bancos — ver crud.delete_task().
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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
    """Cria as tabelas e aplica micro-migrações aditivas (sem perder dados)."""
    # importa os models para registrá-los no metadata antes do create_all
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_columns()


# Colunas adicionadas depois da criação original das tabelas.
# (tabela, coluna, tipo SQL) — a sintaxe usada é compatível com SQLite e Postgres.
_ADDITIVE_COLUMNS = (
    ("tasks", "parent_id", "INTEGER"),
    ("users", "hashed_password", "VARCHAR(255)"),
    ("tasks", "due_date", "DATE"),
    ("tasks", "due_time", "VARCHAR(5)"),
)


def _ensure_columns() -> None:
    """Adiciona colunas novas em tabelas já existentes, de forma idempotente.
    Mantém o banco atual sem precisar recriá-lo.

    Uma falha no ALTER (permissão, lock) apenas registra um aviso: derrubar o
    boot deixaria a API inteira fora do ar, quando o efeito real é só uma coluna
    ausente. As rotas que dependem dela degradam sozinhas.
    """
    import logging

    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    for table, column, sql_type in _ADDITIVE_COLUMNS:
        try:
            cols = {c["name"] for c in inspector.get_columns(table)}
        except Exception:
            continue  # tabela ainda não existe (create_all cuidou) — nada a fazer

        if column not in cols:
            try:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
            except Exception:
                logging.getLogger("uvicorn.error").warning(
                    "Não foi possível adicionar a coluna %s.%s — siga com a migração manual.",
                    table, column,
                )
