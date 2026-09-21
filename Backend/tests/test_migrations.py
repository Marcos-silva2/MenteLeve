"""Micro-migração aditiva: bancos antigos ganham as colunas novas sem perder dados."""
from __future__ import annotations

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app import database
from app.models import Task, User


def _banco_antigo(tmp_path):
    """SQLite no esquema anterior a recorrência, versão de sessão e prazo estruturado."""
    engine = create_engine(f"sqlite:///{(tmp_path / 'antigo.db').as_posix()}")
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, "
            "name TEXT NOT NULL, hashed_password VARCHAR(255), is_premium BOOLEAN NOT NULL, created_at DATETIME)"
        ))
        conn.execute(text(
            "CREATE TABLE tasks (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, "
            "category VARCHAR(40) NOT NULL, due VARCHAR(120) NOT NULL, done BOOLEAN NOT NULL, "
            "important BOOLEAN NOT NULL, created_at DATETIME)"
        ))
        conn.execute(text(
            "INSERT INTO users (id, email, name, hashed_password, is_premium) VALUES (1, 'velha@example.com', 'Velha', 'hash', 1)"
        ))
        conn.execute(text(
            "INSERT INTO tasks (id, user_id, title, category, due, done, important) "
            "VALUES (1, 1, 'Tarefa antiga', 'casa', 'Hoje', 0, 1)"
        ))
    return engine


def test_colunas_novas_sao_adicionadas_e_dados_antigos_sobrevivem(tmp_path, monkeypatch):
    legado = _banco_antigo(tmp_path)
    monkeypatch.setattr(database, "engine", legado)

    database._ensure_columns()

    cols_users = {c["name"] for c in inspect(legado).get_columns("users")}
    cols_tasks = {c["name"] for c in inspect(legado).get_columns("tasks")}
    assert "token_version" in cols_users
    assert {"is_recurring", "recurrence_pattern"} <= cols_tasks

    # As linhas existentes nascem com os valores neutros — via ORM, como o app lê.
    with Session(legado) as db:
        user = db.scalar(select(User))
        task = db.scalar(select(Task))
        assert user.email == "velha@example.com" and user.is_premium is True
        assert user.token_version == 0
        assert task.title == "Tarefa antiga" and task.important is True
        assert task.is_recurring is False
        assert task.recurrence_pattern is None


def test_migracao_e_idempotente(tmp_path, monkeypatch):
    legado = _banco_antigo(tmp_path)
    monkeypatch.setattr(database, "engine", legado)
    database._ensure_columns()
    database._ensure_columns()  # segunda rodada não pode falhar nem duplicar
    cols = [c["name"] for c in inspect(legado).get_columns("tasks")]
    assert cols.count("is_recurring") == 1


def test_token_antigo_continua_valido_para_conta_migrada(tmp_path, monkeypatch):
    """Conta migrada fica com token_version 0 — a mesma versão dos JWTs sem o claim."""
    legado = _banco_antigo(tmp_path)
    monkeypatch.setattr(database, "engine", legado)
    database._ensure_columns()
    with Session(legado) as db:
        assert db.scalar(select(User)).token_version == 0
