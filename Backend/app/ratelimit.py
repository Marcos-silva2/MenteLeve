"""Limitador de tentativas em memória (janela deslizante).

Usado por `/auth/login`. Não é um rate limit distribuído: o estado vive no
processo. No Render free a API roda em **um** processo, então a contagem é
exata; se um dia houver mais de uma instância, cada uma terá a sua própria
contagem e o teto efetivo será `limite × instâncias`. Ainda assim transforma
força bruta de "ilimitada" em "cara", que é o objetivo.

Só falhas são contadas. Um acerto zera o contador da chave — quem sabe a senha
nunca é bloqueada por ter errado antes.
"""
from __future__ import annotations

import threading
import time
from collections import deque

# Teto de chaves distintas guardadas. Impede que um atacante variando o e-mail
# a cada tentativa faça o dicionário crescer sem limite (o processo do Render
# free tem pouca memória). Ao estourar, a limpeza remove as janelas vencidas.
_MAX_KEYS = 10_000


class SlidingWindowLimiter:
    """Conta eventos por chave dentro de uma janela de tempo deslizante."""

    def __init__(self, max_hits: int, window_seconds: float) -> None:
        self.max_hits = max_hits
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        """Descarta os eventos que saíram da janela e devolve a fila da chave."""
        q = self._hits.get(key)
        if q is None:
            q = deque()
            self._hits[key] = q
        while q and (now - q[0]) > self.window:
            q.popleft()
        return q

    def _sweep(self, now: float) -> None:
        """Remove chaves cujas janelas venceram por completo."""
        vencidas = [k for k, q in self._hits.items() if not q or (now - q[-1]) > self.window]
        for k in vencidas:
            self._hits.pop(k, None)

    def retry_after(self, key: str) -> int:
        """Segundos até liberar; 0 quando ainda há tentativas disponíveis."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, now)
            if len(q) < self.max_hits:
                return 0
            # A vaga só abre quando o evento mais antigo sair da janela.
            return max(1, int(self.window - (now - q[0])) + 1)

    def record(self, key: str) -> None:
        """Registra uma falha para a chave."""
        now = time.monotonic()
        with self._lock:
            if len(self._hits) >= _MAX_KEYS:
                self._sweep(now)
            self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        """Zera a contagem da chave (chamado após um acerto)."""
        with self._lock:
            self._hits.pop(key, None)
