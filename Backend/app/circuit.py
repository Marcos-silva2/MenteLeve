"""Circuit breaker em memória — evita pagar o timeout cheio do Gemini em toda
requisição durante uma indisponibilidade (cota estourada, provedor fora do ar).

Mesma forma de app/ratelimit.py (lock, estado em memória, sem dependência
nova): correto pelo mesmo motivo — um único processo Uvicorn (ver Procfile).
Se o processo virar múltiplas instâncias, este estado vale por instância; não
é o objetivo agora (ver docs/estado-atual.md).
"""
from __future__ import annotations

import threading
import time


class CircuitBreaker:
    """Abre após `fail_threshold` falhas seguidas; fecha sozinho após `cooldown_seconds`.

    Meio-aberto: passado o cooldown, deixa UMA tentativa passar. Se ela falhar,
    reabre e reinicia o cooldown; se for bem-sucedida, fecha de vez.
    """

    def __init__(self, fail_threshold: int, cooldown_seconds: float) -> None:
        self.fail_threshold = fail_threshold
        self.cooldown = cooldown_seconds
        self._fails = 0
        self._opened_at: float | None = None
        self._half_open_probe = False
        self._lock = threading.Lock()

    def allow(self) -> bool:
        """True quando a chamada pode ser tentada."""
        with self._lock:
            if self._opened_at is None:
                return True
            if time.monotonic() - self._opened_at < self.cooldown:
                return False
            # Cooldown vencido: libera uma tentativa de teste (meio-aberto).
            if self._half_open_probe:
                return False  # já há uma tentativa de teste em voo
            self._half_open_probe = True
            return True

    def record(self, ok: bool) -> None:
        """Registra o resultado de uma tentativa permitida por `allow()`."""
        with self._lock:
            self._half_open_probe = False
            if ok:
                self._fails = 0
                self._opened_at = None
            else:
                self._fails += 1
                if self._fails >= self.fail_threshold:
                    self._opened_at = time.monotonic()
