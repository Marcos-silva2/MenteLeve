"""Fixtures dos testes do backend.

ISOLAMENTO: o `Backend/.env` real pode apontar para o Supabase e trazer chaves de
IA de verdade. `app.config` só usa o `.env` para variáveis AUSENTES do ambiente
(`os.environ.setdefault`), então definimos tudo aqui, ANTES de importar o app:
banco SQLite num arquivo temporário, chaves de teste e IA desligada.
Nenhum teste toca o banco de produção nem faz chamada externa.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="menteleve-tests-"))

os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "chave-de-teste-nao-usar-em-producao"
os.environ["ENCRYPTION_KEY"] = "ab" * 32  # 32 bytes em hex — só para testes
# Vazio (e não ausente): o setdefault do .env não sobrescreve valor já presente.
os.environ["GOOGLE_AI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import database  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402

# Trava de segurança: se algo mudar a ordem dos imports e o .env vencer, os
# testes param aqui em vez de escrever em outro banco.
assert database.settings.DATABASE_URL.startswith("sqlite:///"), "testes exigem SQLite"
assert str(_TMP.as_posix()) in database.settings.DATABASE_URL, "testes exigem o banco temporário"


@pytest.fixture(autouse=True)
def _banco_limpo():
    """Tabelas novas a cada teste e contadores de rate limit zerados."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    for limiter in (
        auth_router._login_by_email,
        auth_router._login_by_ip,
    ):
        limiter._hits.clear()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ----------------------- helpers -----------------------
def registrar(client: TestClient, email: str = "ana@example.com", password: str = "senha123", name: str = "Ana") -> dict:
    r = client.post("/auth/register", json={"email": email, "name": name, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def usuaria(client):
    """Usuária cadastrada + cabeçalhos de autenticação."""
    data = registrar(client)
    return {"token": data["access_token"], "headers": auth_headers(data["access_token"]), "user": data["user"]}
