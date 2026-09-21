"""Hash de senhas (bcrypt) e tokens de acesso (JWT)."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

# O bcrypt opera sobre no máximo 72 bytes e, a partir da 4.x, levanta ValueError
# se receber mais que isso. Como o app é em português (acentos = multi-byte),
# truncamos explicitamente para manter o comportamento previsível.
_MAX_PASSWORD_BYTES = 72

# Hash descartável usado para gastar o mesmo tempo de um verify real quando o
# e-mail não existe — sem isso, o tempo de resposta revela quais e-mails têm conta.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-timing", bcrypt.gensalt()).decode()


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_MAX_PASSWORD_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), hashed.encode())
    except (ValueError, TypeError):
        return False


def dummy_verify() -> None:
    """Consome o tempo de um bcrypt.checkpw sem ter um hash real para comparar."""
    bcrypt.checkpw(b"dummy-password-for-timing", _DUMMY_HASH.encode())


def create_access_token(user_id: int, token_version: int = 0) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # `tv` = versão da sessão do usuário (users.token_version): trocar a senha
    # incrementa a versão e derruba todos os tokens emitidos antes.
    payload = {"sub": str(user_id), "tv": int(token_version), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> tuple[int, int] | None:
    """Retorna (id do usuário, versão da sessão), ou None se inválido/expirado.

    Tokens emitidos antes da existência do claim `tv` valem como versão 0 — a
    mesma que as contas antigas têm no banco —, então ninguém é deslogado por
    causa do deploy.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return int(payload["sub"]), int(payload.get("tv", 0))
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None


def decode_access_token(token: str) -> int | None:
    """Retorna o id do usuário, ou None se o token for inválido/expirado."""
    decoded = decode_token(token)
    return decoded[0] if decoded else None


def new_reset_token() -> str:
    """Token de recuperação: 256 bits, seguro para ir numa URL."""
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    """SHA-256 em hexadecimal — o que de fato é guardado no banco."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
