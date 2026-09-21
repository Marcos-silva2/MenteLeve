"""Autenticação: cadastro, login e JWT."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

from app import security
from app.config import settings
from app.database import SessionLocal
from app.models import User

from conftest import auth_headers, registrar


# ----------------------- cadastro -----------------------
def test_cadastro_devolve_token_e_usuaria(client):
    r = client.post("/auth/register", json={"email": "ana@example.com", "name": "Ana", "password": "senha123"})
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "ana@example.com"
    assert body["user"]["name"] == "Ana"
    assert body["user"]["is_premium"] is False
    # Nunca devolve a senha nem o hash.
    assert "password" not in body["user"] and "hashed_password" not in body["user"]


def test_senha_e_guardada_como_hash_bcrypt(client):
    registrar(client, password="senha123")
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.hashed_password != "senha123"
        assert user.hashed_password.startswith("$2")
        assert security.verify_password("senha123", user.hashed_password)


def test_cadastro_com_email_repetido_da_409(client):
    registrar(client)
    r = client.post("/auth/register", json={"email": "ana@example.com", "name": "Outra", "password": "outra123"})
    assert r.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "sem-arroba", "name": "A", "password": "senha123"},
        {"email": "a@example.com", "name": "A", "password": "123"},  # < 6 caracteres
        {"name": "A", "password": "senha123"},
    ],
)
def test_cadastro_invalido_da_422(client, payload):
    assert client.post("/auth/register", json=payload).status_code == 422


# ----------------------- login + JWT -----------------------
def test_login_com_credenciais_corretas_emite_jwt_valido(client):
    registrar(client)
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert claims["sub"] == str(r.json()["user"]["id"])
    assert claims["exp"] > datetime.now(timezone.utc).timestamp()

    assert client.get("/auth/me", headers=auth_headers(token)).json()["email"] == "ana@example.com"


def test_login_com_senha_errada_da_401_generico(client):
    registrar(client)
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "errada123"})
    assert r.status_code == 401
    assert r.json()["detail"] == "E-mail ou senha incorretos."


def test_login_com_email_inexistente_tem_a_mesma_resposta_da_senha_errada(client):
    """Não revela se o e-mail tem conta."""
    registrar(client)
    errada = client.post("/auth/login", json={"email": "ana@example.com", "password": "errada123"})
    inexistente = client.post("/auth/login", json={"email": "ninguem@example.com", "password": "senha123"})
    assert inexistente.status_code == errada.status_code == 401
    assert inexistente.json() == errada.json()


def test_login_e_bloqueado_apos_muitas_falhas(client, monkeypatch):
    registrar(client)
    for _ in range(settings.LOGIN_MAX_ATTEMPTS):
        assert client.post("/auth/login", json={"email": "ana@example.com", "password": "errada123"}).status_code == 401
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha123"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_rota_protegida_sem_token_da_401(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/tasks").status_code == 401


def test_token_adulterado_ou_de_outra_chave_da_401(client):
    registrar(client)
    falso = jwt.encode({"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(days=1)}, "outra-chave", algorithm="HS256")
    assert client.get("/auth/me", headers=auth_headers(falso)).status_code == 401
    assert client.get("/auth/me", headers=auth_headers("lixo.lixo.lixo")).status_code == 401


def test_token_expirado_da_401(client):
    dados = registrar(client)
    expirado = jwt.encode(
        {"sub": str(dados["user"]["id"]), "exp": datetime.now(timezone.utc) - timedelta(seconds=5)},
        settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )
    assert client.get("/auth/me", headers=auth_headers(expirado)).status_code == 401
