"""Hora de término de uma tarefa (bloco de tempo) a partir do texto livre.

"das 10h às 11h30" -> 11:30; "reunião de 1h" / "por 45 min" / "1h30 de call" -> início + duração.
Espelhado em Frontend/js/dates.js (detectEndTime). Sem horário de início, não há fim.
"""
from __future__ import annotations

import re
import unicodedata

_HORA = r"(\d{1,2})(?:[:h](\d{2})?)?"
# "das 9 às 18" basta; com "de", a hora precisa de "h" ou ":" — senão "de 15 a 20 de
# outubro" (datas) viraria horário.
_INTERVALO = re.compile(
    rf"\b(?:das\s+{_HORA}|de\s+(\d{{1,2}})[:h](\d{{2}})?)\s*h?\s*(?:as|ate|a|-)\s*{_HORA}\s*h?\b"
)
_DURACAO = re.compile(
    r"\b(?:de|por|durante|dura)\s+(?:(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:min(?:utos?)?)?"
    r"|(\d{1,3})\s*min(?:utos?)?)\b"
)


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFD", str(text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def to_minutes(hhmm: str | None) -> int | None:
    if not hhmm or not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", hhmm):
        return None
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def from_minutes(total: int) -> str | None:
    if total is None or not 0 <= total < 24 * 60:
        return None
    return f"{total // 60:02d}:{total % 60:02d}"


def clean_end_time(start: str | None, end: str | None) -> str | None:
    """Fim só vale com início e depois dele, no mesmo dia."""
    ini, fim = to_minutes(start), to_minutes(end)
    if ini is None or fim is None or fim <= ini:
        return None
    return end


def detect_end_time(text: str, start: str | None) -> str | None:
    ini = to_minutes(start)
    if ini is None:
        return None
    t = _fold(text)
    m = _INTERVALO.search(t)
    if m:
        h2, m2 = m.group(5), m.group(6)
        if int(h2) <= 23 and int(m2 or 0) <= 59:
            return clean_end_time(start, f"{int(h2):02d}:{int(m2 or 0):02d}")
    m = _DURACAO.search(t)
    if m:
        horas, mins, so_min = m.groups()
        dur = int(so_min) if so_min else int(horas or 0) * 60 + int(mins or 0)
        if 0 < dur <= 12 * 60:
            return clean_end_time(start, from_minutes(ini + dur))
    return None
