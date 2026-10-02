"""Espaços compartilhados: código de convite e limites."""
from __future__ import annotations

import re
import secrets

# Sem 0/O, 1/I/L: o código é digitado a partir de uma mensagem ou ditado.
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8

MAX_SPACES_PER_USER = 10
MAX_MEMBERS_PER_SPACE = 20


def new_invite_code() -> str:
    return "".join(secrets.choice(_ALFABETO) for _ in range(CODE_LENGTH))


def normalize_code(value: str) -> str:
    """"abcd-efgh", " ABCD EFGH " e "ABCDEFGH" são o mesmo código."""
    return re.sub(r"[\s\-]", "", str(value or "")).upper()


def format_code(code: str) -> str:
    """ABCDEFGH -> ABCD-EFGH (para mostrar)."""
    return f"{code[:4]}-{code[4:]}" if len(code) == CODE_LENGTH else code
