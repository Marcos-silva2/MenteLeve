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

# Dias da semana no padrão de `date.weekday()`: segunda = 0 ... domingo = 6.
# O frontend usa a mesma numeração (ver dates.js), NÃO a do `Date.getDay()` do JS.
WORKDAYS = (0, 1, 2, 3, 4)


def clean_pattern(value: object) -> str | None:
    """Aceita só daily | weekly | monthly; qualquer outra coisa vira None."""
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in PATTERNS else None


def clean_weekdays(value: object) -> list[int] | None:
    """Lista de dias (0=segunda..6=domingo), ordenada e sem repetição.

    Aceita lista/tupla de inteiros ou o texto "0,2,4" (como fica no banco). Vazio,
    inválido ou "todos os 7 dias" (isso é diário) vira None.
    """
    if isinstance(value, str):
        value = [p for p in value.split(",") if p.strip()]
    if not isinstance(value, (list, tuple)):
        return None
    dias = set()
    for v in value:
        try:
            n = int(v)
        except (TypeError, ValueError):
            return None
        if not 0 <= n <= 6:
            return None
        dias.add(n)
    if not dias or len(dias) == 7:
        return None
    return sorted(dias)


def _add_months(anchor: date, months: int) -> date:
    """`anchor` + N meses, mantendo o dia e limitando ao último dia do mês
    (31/jan + 1 mês = 28 ou 29/fev)."""
    index = anchor.year * 12 + (anchor.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def next_occurrence(
    due: date | None,
    pattern: str,
    today: date,
    weekdays: list[int] | None = None,
    until: date | None = None,
) -> date | None:
    """Próxima ocorrência; None quando a série terminou (passou de `until`).

    `weekdays` (só para weekly): dias específicos, ex. [0, 2, 4] = seg/qua/sex ou
    [0..4] = dias úteis. A próxima é o primeiro desses dias depois de hoje e do
    prazo atual.
    """
    if pattern == "weekly" and weekdays:
        dia = max(due or today, today) + timedelta(days=1)
        while dia.weekday() not in weekdays:
            dia += timedelta(days=1)
        nxt = dia
    else:
        nxt = _next_simple(due, pattern, today)
    if until is not None and nxt > until:
        return None
    return nxt


def _next_simple(due: date | None, pattern: str, today: date) -> date:
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
    rf"|todo\s+(?:sabado|domingo)|todos\s+os\s+(?:sabados|domingos)"
    rf"|(?:tod[oa]s?\s+(?:os\s+)?)?dias?\s+uteis|dia\s+util"
    rf"|de\s+{_WEEKDAYS}(?:[-\s]feira)?\s+a\s+{_WEEKDAYS}"
    rf"|(?:as|nas)\s+{_WEEKDAYS}s(?:[-\s]feiras)?)\b"
)
_UTEIS = re.compile(r"\bdias?\s+uteis\b|\bdia\s+util\b")
_RANGE = re.compile(rf"\bde\s+({_WEEKDAYS})(?:[-\s]feira)?\s+a\s+({_WEEKDAYS})\b")
_NAMES = re.compile(rf"\b({_WEEKDAYS})s?\b")

_MESES = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
    "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}
_UNTIL_NUM = re.compile(r"\bate\s+(?:o\s+)?(?:dia\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b")
_UNTIL_MES = re.compile(
    r"\bate\s+(?:o\s+)?(?:(?:dia\s+)?(\d{1,2})\s+de\s+)?(" + "|".join(_MESES) + r")(?:\s+de\s+(\d{4}))?\b"
)
_DAILY = re.compile(
    r"\b(?:todo\s+dia|todos\s+os\s+dias|cada\s+dia|diari[oa](?:mente)?"
    r"|toda\s+(?:manha|tarde|noite)|todas\s+as\s+(?:manhas|tardes|noites))\b"
)


_WEEKDAY_INDEX = {  # date.weekday(): segunda = 0
    "segunda": 0, "terca": 1, "quarta": 2, "quinta": 3, "sexta": 4, "sabado": 5, "domingo": 6,
}


def detect_weekdays(text: str) -> list[int] | None:
    """Dias específicos de uma recorrência semanal, ou None.

    "dias úteis" / "de segunda a sexta" -> [0..4]; "de terça a quinta" -> [1, 2, 3];
    "toda segunda e quarta" / "às segundas, quartas e sextas" -> [0, 2, 4].
    Um dia só ("toda segunda") devolve None: o semanal simples já cobre.
    """
    t = _fold(text)
    if _UTEIS.search(t):
        return list(WORKDAYS)
    m = _RANGE.search(t)
    if m:
        a, b = _WEEKDAY_INDEX[m.group(1)], _WEEKDAY_INDEX[m.group(2)]
        dias = [(a + i) % 7 for i in range((b - a) % 7 + 1)]
        return clean_weekdays(dias)
    if not _WEEKLY.search(t):
        return None
    nomes = {_WEEKDAY_INDEX[n] for n in _NAMES.findall(t)}
    return clean_weekdays(sorted(nomes)) if len(nomes) >= 2 else None


def detect_until(text: str, today: date) -> date | None:
    """Fim da série dito no texto: "até 20/12", "até 15 de março", "até dezembro".

    Sem ano, vale a próxima data possível a partir de hoje. "até dezembro" = último
    dia do mês.
    """
    t = _fold(text)
    m = _UNTIL_NUM.search(t)
    if m:
        dia, mes = int(m.group(1)), int(m.group(2))
        ano = int(m.group(3)) if m.group(3) else None
        if ano is not None and ano < 100:
            ano += 2000
        return _data_futura(dia, mes, ano, today)
    m = _UNTIL_MES.search(t)
    if m:
        mes = _MESES[m.group(2)]
        ano = int(m.group(3)) if m.group(3) else None
        dia = int(m.group(1)) if m.group(1) else None
        return _data_futura(dia, mes, ano, today)
    return None


def _data_futura(dia: int | None, mes: int, ano: int | None, today: date) -> date | None:
    if not 1 <= mes <= 12:
        return None
    anos = [ano] if ano else [today.year, today.year + 1]
    for a in anos:
        ultimo = calendar.monthrange(a, mes)[1]
        d = ultimo if dia is None else dia
        if not 1 <= d <= ultimo:
            return None
        candidato = date(a, mes, d)
        if ano or candidato >= today:
            return candidato
    return None


def first_occurrence(
    text: str, pattern: str, today: date, weekdays: list[int] | None = None
) -> date:
    """Data da primeira ocorrência quando o texto não trouxe uma explícita.

    "todo dia" -> hoje; "toda segunda" -> a próxima segunda (hoje, se já for);
    "todo dia 10" -> o próximo dia 10 (hoje, se for dia 10); dias específicos ->
    o primeiro deles a partir de hoje. Sem pista no texto, começa hoje.
    """
    if pattern == "weekly" and weekdays:
        dia = today
        while dia.weekday() not in weekdays:
            dia += timedelta(days=1)
        return dia
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


def resolve(
    text: str,
    today: date,
    pattern: object = None,
    weekdays: object = None,
    until: date | None = None,
    due_date: date | None = None,
) -> dict:
    """Junta o que a IA disse (pode faltar ou vir errado) com a detecção por regra.

    Usado pelo /tasks/smart, pelo fallback sem IA e pela Bruna, para que os três
    cheguem à mesma recorrência para o mesmo texto. Devolve os campos da tarefa:
    is_recurring, recurrence_pattern, recurrence_weekdays, recurrence_until, due_date.
    """
    p = clean_pattern(pattern) or detect_recurrence(text)
    dias = clean_weekdays(weekdays) or (detect_weekdays(text) if p in (None, "weekly") else None)
    if dias:
        p = "weekly"
    if p is None:
        return {"is_recurring": False, "recurrence_pattern": None, "recurrence_weekdays": None,
                "recurrence_until": None, "due_date": due_date}
    fim = until or detect_until(text, today)
    if due_date is None:
        due_date = first_occurrence(text, p, today, dias)
    return {"is_recurring": True, "recurrence_pattern": p, "recurrence_weekdays": dias,
            "recurrence_until": fim, "due_date": due_date}


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
