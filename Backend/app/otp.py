"""Código de verificação por e-mail (A2F) no login — armazenamento em memória.

Mesma forma de app/ratelimit.py e app/circuit.py: estado no processo, correto
pelo mesmo motivo — um único worker Uvicorn (ver Procfile). Um código dura
poucos minutos; perder o estado num restart do Render só custa pedir um novo,
nunca deixa ninguém com uma sessão presa.
"""
from __future__ import annotations

import secrets
import threading
import time


class _Entry:
    __slots__ = ("code", "expires_at", "attempts")

    def __init__(self, code: str, expires_at: float) -> None:
        self.code = code
        self.expires_at = expires_at
        self.attempts = 0


class LoginOtpStore:
    def __init__(self, length: int, ttl_seconds: float, max_attempts: int) -> None:
        self.length = length
        self.ttl = ttl_seconds
        self.max_attempts = max_attempts
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()

    def generate(self, key: str) -> str:
        """Gera (e substitui) o código da chave — um pedido novo invalida o
        anterior, então reenviar nunca deixa dois códigos válidos ao mesmo tempo."""
        code = "".join(secrets.choice("0123456789") for _ in range(self.length))
        with self._lock:
            self._entries[key] = _Entry(code, time.monotonic() + self.ttl)
        return code

    def verify(self, key: str, code: str) -> bool:
        """True se o código bate e ainda vale.

        Consome a entrada em qualquer acerto (o código não é reutilizável) e
        também ao esgotar as tentativas (força pedir um novo em vez de deixar
        a mesma janela aberta para tentativa infinita)."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None or time.monotonic() > entry.expires_at:
                self._entries.pop(key, None)
                return False
            entry.attempts += 1
            if entry.attempts > self.max_attempts:
                self._entries.pop(key, None)
                return False
            if not secrets.compare_digest(entry.code, code):
                return False
            self._entries.pop(key, None)
            return True
