"""Tarefas recorrentes: cálculo da próxima ocorrência e detecção em texto livre.

Comportamento ao concluir uma tarefa recorrente (decisão de projeto):

    A tarefa NÃO é duplicada. Concluir "rola" o prazo da MESMA linha para a
    próxima ocorrência e ela continua em aberto (`done` segue falso).

Por que assim, e não criando uma cópia para a próxima data:

- O app é local-first: a conclusão acontece no aparelho (talvez offline) e sobe
  depois pela fila de sincronização. Com "cópia", o aparelho criaria a próxima
  tarefa localmente E o servidor criaria outra ao receber a conclusão — duas
  tarefas para o mesmo ciclo. Rolar o prazo é uma operação sobre uma linha só, e o
  cliente e o servidor chegam ao mesmo resultado pela mesma função (esta, espelhada
  em Frontend/js/dates.js → nextOccurrence).
- Não consome o limite de 50 tarefas do plano gratuito a cada ciclo.
- O lembrete push (`reminder_sent_at`) é reposto junto, para avisar de novo.

Custo aceito: não há histórico de "feito ontem"; a tarefa mostra só o próximo ciclo.
"""
from __future__ import annotations

import calendar
import re
import unicodedata
from datetime import date, timedelta

PATTERNS = ("daily", "weekly", "monthly")


def clean_pattern(value: object) -> str | None:
    """Aceita só daily | weekly | monthly; qualquer outra coisa vira None."""
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in PATTERNS else None


def _add_months(anchor: date, months: int) -> date:
    """`anchor` + N meses, mantendo o dia e limitando ao último dia do mês
    (31/jan + 1 mês = 28 ou 29/fev)."""
    index = anchor.year * 12 + (anchor.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def next_occurrence(due: date | None, pattern: str, today: date) -> date:
    """Primeira ocorrência estritamente posterior a `today` e ao prazo atual.

    - Concluída em dia (prazo hoje):            próxima = prazo + 1 ciclo.
    - Concluída adiantada (prazo no futuro):    próxima = prazo + 1 ciclo.
    - Concluída atrasada (prazo no passado):    pula os ciclos perdidos e cai na
      primeira ocorrência depois de hoje, mantendo o dia da semana / do mês.
    - Sem prazo:                                conta a partir de hoje.

    `today` vem do cliente (data local da usuária); o servidor roda em UTC e, à
    noite no Brasil, o "hoje" dele já é o dia seguinte.
    """
    if pattern not in PATTERNS:
        raise ValueError(f"Padrão de recorrência inválido: {pattern!r}")

    start = due or today

    def step(k: int) -> date:
        if pattern == "daily":
            return start + timedelta(days=k)
        if pattern == "weekly":
            return start + timedelta(weeks=k)
        return _add_months(start, k)

    k = 1
    candidate = step(k)
    while candidate <= today:
        k += 1
        candidate = step(k)
    return candidate


# ------------------------------------------------------------------
# Detecção em texto livre
#
# A IA é a fonte principal (ver ai.py), mas ela pode omitir o campo ou estar
# fora do ar. Esta detecção determinística é a rede de segurança: ela é aplicada
# no fallback do /tasks/smart e sempre que o modelo não devolve um padrão.
# ------------------------------------------------------------------
def _fold(text: str) -> str:
    """Minúsculas e sem acentos: 'Terça' -> 'terca'."""
    text = unicodedata.normalize("NFD", str(text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


_WEEKDAYS = r"(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)"

# "todo dia 10" / "todo dia 10 do mês": um dia FIXO do mês. Vem antes de "todo
# dia" (diário). O lookahead evita "todo dia 8h"/"todo dia 8:00", que é horário.
_MONTHLY_DAY = re.compile(r"\btod[oa]s?\s+(?:os\s+)?dias?\s+(\d{1,2})(?![\d:h]|\s*horas?\b)")
_MONTHLY = re.compile(
    r"\b(?:todo\s+mes|todos\s+os\s+meses|cada\s+mes|mensal(?:mente)?)\b"
)
_WEEKLY = re.compile(
    rf"\b(?:toda\s+semana|todas\s+as\s+semanas|cada\s+semana|semanal(?:mente)?"
    rf"|toda\s+{_WEEKDAYS}(?:[-\s]feira)?|todas\s+as\s+{_WEEKDAYS}s?(?:[-\s]feiras?)?"
    rf"|todo\s+(?:sabado|domingo)|todos\s+os\s+(?:sabados|domingos))\b"
)
_DAILY = re.compile(
    r"\b(?:todo\s+dia|todos\s+os\s+dias|cada\s+dia|diari[oa](?:mente)?"
    r"|toda\s+(?:manha|tarde|noite)|todas\s+as\s+(?:manhas|tardes|noites))\b"
)


_WEEKDAY_INDEX = {  # date.weekday(): segunda = 0
    "segunda": 0, "terca": 1, "quarta": 2, "quinta": 3, "sexta": 4, "sabado": 5, "domingo": 6,
}


def first_occurrence(text: str, pattern: str, today: date) -> date:
    """Data da primeira ocorrência quando o texto não trouxe uma explícita.

    "todo dia" -> hoje; "toda segunda" -> a próxima segunda (hoje, se já for);
    "todo dia 10" -> o próximo dia 10 (hoje, se for dia 10). Sem pista no texto,
    começa hoje.
    """
    t = _fold(text)
    if pattern == "weekly":
        m = re.search(rf"\b({_WEEKDAYS})\b", t)
        if m:
            return today + timedelta(days=(_WEEKDAY_INDEX[m.group(1)] - today.weekday()) % 7)
    if pattern == "monthly":
        m = _MONTHLY_DAY.search(t)
        if m and 1 <= int(m.group(1)) <= 31:
            day = int(m.group(1))
            this_month = _add_months(date(today.year, today.month, 1), 0)
            candidate = this_month.replace(day=min(day, calendar.monthrange(today.year, today.month)[1]))
            if candidate < today:
                nxt = _add_months(this_month, 1)
                candidate = nxt.replace(day=min(day, calendar.monthrange(nxt.year, nxt.month)[1]))
            return candidate
    return today


def detect_recurrence(text: str) -> str | None:
    """Reconhece "todo dia", "toda segunda-feira", "todo dia 10", "todo mês"…

    Devolve daily | weekly | monthly, ou None quando o texto não pede repetição.
    """
    t = _fold(text)
    m = _MONTHLY_DAY.search(t)
    if m and 1 <= int(m.group(1)) <= 31:
        return "monthly"
    if _MONTHLY.search(t):
        return "monthly"
    if _WEEKLY.search(t):
        return "weekly"
    if _DAILY.search(t):
        return "daily"
    return None
