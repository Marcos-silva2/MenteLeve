"""Criptografia do conteúdo em repouso (AES-256-GCM).

Protege contra quem chega ao banco **por fora da API**: um dump do Postgres, a
`DATABASE_URL` vazada ou o painel do Supabase. A chave vive no ambiente do
processo, nunca no banco — então o dump sozinho não serve para nada.

Não protege contra o comprometimento do servidor (lá a chave está presente), nem
esconde o texto da IA: a Bruna continua enviando os títulos para o Gemini/Groq.

O uso é transparente: os models declaram `EncryptedText` e o resto do código
(crud, routers, schemas, ai) continua vendo texto puro.
"""
from __future__ import annotations

import base64
import os
from functools import lru_cache

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import settings

# Marca o envelope. Valor sem o prefixo é texto puro de antes desta mudança e é
# lido como está — assim o deploy não precisa de migração para funcionar. Também
# permite trocar de algoritmo no futuro sem reescrever o banco inteiro.
_PREFIX = "v1:"

# 96 bits é o tamanho de nonce recomendado para o GCM (o único em que a
# construção é comprovadamente segura e o mais rápido).
_NONCE_BYTES = 12

_KEY_BYTES = 32  # AES-256


class EncryptionKeyError(RuntimeError):
    """Chave ausente, malformada ou diferente da que gravou o dado."""


@lru_cache(maxsize=1)
def _cipher() -> AESGCM | None:
    """Devolve o cifrador, ou None quando não há chave configurada.

    Sem chave o app funciona em texto puro (conveniência de desenvolvimento) e
    avisa no boot — ver `main.py`. Deliberadamente **não** existe fallback de
    chave aleatória como no SECRET_KEY: uma chave nova a cada processo tornaria
    ilegível tudo que foi gravado antes do restart.
    """
    raw = settings.ENCRYPTION_KEY.strip()
    if not raw:
        return None

    try:
        key = bytes.fromhex(raw)
    except ValueError as exc:
        raise EncryptionKeyError(
            "ENCRYPTION_KEY não é hexadecimal. Gere uma com: "
            'python -c "import secrets; print(secrets.token_hex(32))"'
        ) from exc

    if len(key) != _KEY_BYTES:
        raise EncryptionKeyError(
            f"ENCRYPTION_KEY tem {len(key)} bytes, esperados {_KEY_BYTES} "
            f"({_KEY_BYTES * 2} caracteres hex)."
        )

    return AESGCM(key)


def encryption_active() -> bool:
    """True quando há chave válida — usado no aviso de boot."""
    return _cipher() is not None


def is_encrypted(value: str | None) -> bool:
    return bool(value) and value.startswith(_PREFIX)


def encrypt(value: str | None) -> str | None:
    """Texto puro -> `v1:<base64url(nonce || ciphertext || tag)>`.

    Nonce novo a cada chamada: o mesmo título gravado duas vezes gera valores
    diferentes, então o banco não revela quais tarefas se repetem.
    """
    if value is None:
        return None

    aes = _cipher()
    if aes is None:
        return value

    nonce = os.urandom(_NONCE_BYTES)
    blob = nonce + aes.encrypt(nonce, value.encode("utf-8"), None)
    return _PREFIX + base64.urlsafe_b64encode(blob).decode("ascii")


def decrypt(value: str | None) -> str | None:
    """Inverso de `encrypt`. Valor sem o prefixo é legado e volta como está."""
    if value is None:
        return None
    if not value.startswith(_PREFIX):
        return value

    aes = _cipher()
    if aes is None:
        # Falhar alto é proposital. Devolver um texto de erro no lugar do título
        # faria a usuária achar que perdeu os dados — e talvez apagar a tarefa.
        # O dado está intacto no banco; falta a chave.
        raise EncryptionKeyError(
            "Há dados criptografados no banco, mas ENCRYPTION_KEY não está "
            "definida. Os dados estão intactos — restaure a chave."
        )

    try:
        blob = base64.urlsafe_b64decode(value[len(_PREFIX):].encode("ascii"))
        return aes.decrypt(blob[:_NONCE_BYTES], blob[_NONCE_BYTES:], None).decode("utf-8")
    except InvalidTag as exc:
        # GCM é autenticado: só chega aqui com a chave errada ou com o valor
        # adulterado no banco. Nos dois casos, devolver lixo seria pior.
        raise EncryptionKeyError(
            "Falha ao decifrar: a ENCRYPTION_KEY não confere com a que gravou "
            "este dado, ou o valor foi alterado no banco."
        ) from exc
    except (ValueError, IndexError) as exc:
        raise EncryptionKeyError("Valor criptografado malformado no banco.") from exc


class EncryptedText(TypeDecorator):
    """Coluna de texto criptografada de forma transparente.

    TEXT (e não VARCHAR(n)) porque o base64 infla ~35%: um título de 500
    caracteres passa de 700 no banco.

    Atenção ao usar: o valor gravado é ciphertext, então **comparação em SQL
    nunca casa** (`WHERE title = 'x'`, LIKE, ORDER BY alfabético). Filtre em
    Python depois de carregar — ver `crud.find_recent_duplicate`.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        return encrypt(value)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        return decrypt(value)
