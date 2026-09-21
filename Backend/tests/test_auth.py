"""Autenticação: cadastro, login, JWT, recuperação de senha e invalidação de sessão."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select, text

from app import security
from app.config import settings
from app.database import SessionLocal
from app.models import PasswordResetToken, User

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
    assert claims["tv"] == 0
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
    falso = jwt.encode({"sub": "1", "tv": 0, "exp": datetime.now(timezone.utc) + timedelta(days=1)}, "outra-chave", algorithm="HS256")
    assert client.get("/auth/me", headers=auth_headers(falso)).status_code == 401
    assert client.get("/auth/me", headers=auth_headers("lixo.lixo.lixo")).status_code == 401


def test_token_expirado_da_401(client):
    dados = registrar(client)
    expirado = jwt.encode(
        {"sub": str(dados["user"]["id"]), "tv": 0, "exp": datetime.now(timezone.utc) - timedelta(seconds=5)},
        settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )
    assert client.get("/auth/me", headers=auth_headers(expirado)).status_code == 401


def test_token_antigo_sem_claim_tv_continua_valido(client):
    """Compatibilidade: JWTs emitidos antes da versão de sessão valem como v0."""
    dados = registrar(client)
    legado = jwt.encode(
        {"sub": str(dados["user"]["id"]), "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )
    assert client.get("/auth/me", headers=auth_headers(legado)).status_code == 200


# ----------------------- recuperação de senha -----------------------
def _pedir_link(client, emails, email="ana@example.com"):
    r = client.post("/auth/forgot-password", json={"email": email})
    assert r.status_code == 202, r.text
    return r


def test_forgot_password_envia_link_com_token_para_conta_existente(client, emails_enviados):
    registrar(client)
    r = _pedir_link(client, emails_enviados)
    assert "enviaremos" in r.json()["message"]

    assert len(emails_enviados) == 1
    enviado = emails_enviados[0]
    assert enviado["email"] == "ana@example.com"
    assert enviado["link"] == f"{settings.FRONTEND_URL}/#reset={enviado['token']}"
    assert len(enviado["token"]) >= 40


def test_forgot_password_nao_revela_se_o_email_existe(client, emails_enviados):
    registrar(client)
    existente = _pedir_link(client, emails_enviados, "ana@example.com")
    inexistente = _pedir_link(client, emails_enviados, "fantasma@example.com")
    assert existente.status_code == inexistente.status_code == 202
    assert existente.json() == inexistente.json()
    assert [e["email"] for e in emails_enviados] == ["ana@example.com"]  # nada foi enviado ao fantasma


def test_token_nao_e_guardado_em_texto_puro(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]
    with SessionLocal() as db:
        linhas = db.execute(text("SELECT token_hash FROM password_reset_tokens")).scalars().all()
    assert linhas == [security.hash_reset_token(token)]
    assert token not in linhas[0]
    assert len(linhas[0]) == 64  # SHA-256 em hex


def test_fluxo_completo_redefine_a_senha(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "novaSenha456"})
    assert r.status_code == 200

    antiga = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha123"})
    assert antiga.status_code == 401
    nova = client.post("/auth/login", json={"email": "ana@example.com", "password": "novaSenha456"})
    assert nova.status_code == 200
    assert client.get("/auth/me", headers=auth_headers(nova.json()["access_token"])).status_code == 200


def test_trocar_a_senha_invalida_os_jwt_antigos(client, emails_enviados):
    dados = registrar(client)
    jwt_antigo = dados["access_token"]
    assert client.get("/auth/me", headers=auth_headers(jwt_antigo)).status_code == 200

    _pedir_link(client, emails_enviados)
    client.post("/auth/reset-password", json={"token": emails_enviados[0]["token"], "new_password": "novaSenha456"})

    assert client.get("/auth/me", headers=auth_headers(jwt_antigo)).status_code == 401
    assert client.get("/tasks", headers=auth_headers(jwt_antigo)).status_code == 401

    with SessionLocal() as db:
        assert db.scalar(select(User)).token_version == 1


def test_token_so_pode_ser_usado_uma_vez(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "primeira123"}).status_code == 200
    segunda = client.post("/auth/reset-password", json={"token": token, "new_password": "segunda123"})
    assert segunda.status_code == 400
    # A senha continua sendo a da primeira redefinição.
    assert client.post("/auth/login", json={"email": "ana@example.com", "password": "primeira123"}).status_code == 200


def test_token_expirado_e_rejeitado(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]
    with SessionLocal() as db:
        row = db.scalar(select(PasswordResetToken))
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "novaSenha456"})
    assert r.status_code == 400
    assert client.post("/auth/login", json={"email": "ana@example.com", "password": "senha123"}).status_code == 200


def test_token_inexistente_e_rejeitado_com_a_mesma_resposta(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    usado = emails_enviados[0]["token"]
    client.post("/auth/reset-password", json={"token": usado, "new_password": "novaSenha456"})

    inexistente = client.post("/auth/reset-password", json={"token": "x" * 43, "new_password": "novaSenha456"})
    reutilizado = client.post("/auth/reset-password", json={"token": usado, "new_password": "novaSenha456"})
    assert inexistente.status_code == reutilizado.status_code == 400
    assert inexistente.json() == reutilizado.json()


def test_novo_pedido_invalida_o_link_anterior(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    _pedir_link(client, emails_enviados)
    primeiro, segundo = emails_enviados[0]["token"], emails_enviados[1]["token"]

    assert client.post("/auth/reset-password", json={"token": primeiro, "new_password": "novaSenha456"}).status_code == 400
    assert client.post("/auth/reset-password", json={"token": segundo, "new_password": "novaSenha456"}).status_code == 200


def test_redefinir_encerra_outros_links_pendentes_da_conta(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]
    # Segundo token pendente inserido direto, como se fosse de outro pedido.
    with SessionLocal() as db:
        db.add(PasswordResetToken(
            user_id=db.scalar(select(User)).id,
            token_hash=security.hash_reset_token("outro-token-pendente-qualquer"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        ))
        db.commit()

    assert client.post("/auth/reset-password", json={"token": token, "new_password": "novaSenha456"}).status_code == 200
    r = client.post("/auth/reset-password", json={"token": "outro-token-pendente-qualquer", "new_password": "outra12345"})
    assert r.status_code == 400


def test_nova_senha_curta_da_422_e_nao_consome_o_token(client, emails_enviados):
    registrar(client)
    _pedir_link(client, emails_enviados)
    token = emails_enviados[0]["token"]
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "123"}).status_code == 422
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "novaSenha456"}).status_code == 200


def test_forgot_password_tem_limite_de_pedidos(client, emails_enviados):
    registrar(client)
    for _ in range(settings.RESET_MAX_REQUESTS):
        _pedir_link(client, emails_enviados)
    r = client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    assert len(emails_enviados) == settings.RESET_MAX_REQUESTS


def test_forgot_password_email_invalido_da_422(client):
    assert client.post("/auth/forgot-password", json={"email": "nao-e-email"}).status_code == 422


def test_sem_provedor_de_email_nada_e_enviado_nem_fingido(client, caplog):
    """Sem RESEND_API_KEY o envio retorna False e o log avisa — sem simular sucesso."""
    from app import mailer

    assert not settings.mail_enabled
    with caplog.at_level("WARNING", logger="uvicorn.error"):
        assert mailer.send_password_reset("ana@example.com", "token-secreto-de-teste") is False
    assert "NENHUM e-mail foi enviado" in caplog.text
    assert "token-secreto-de-teste" not in caplog.text  # o token nunca vai para o log
    assert "ana@example.com" not in caplog.text
