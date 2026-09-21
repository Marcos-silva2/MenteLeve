"""Recorrência: próxima ocorrência e detecção em texto.

Os mesmos casos existem em Frontend/tests/dates.test.mjs — as duas implementações
(Python e JS) precisam concordar, porque cliente e servidor calculam o mesmo
avanço de prazo (um offline, o outro na sincronização).
"""
from __future__ import annotations

from datetime import date

import pytest

from app.recurrence import clean_pattern, detect_recurrence, first_occurrence, next_occurrence

D = date.fromisoformat


@pytest.mark.parametrize(
    "prazo, padrao, hoje, esperado",
    [
        # em dia
        ("2026-09-21", "daily", "2026-09-21", "2026-09-22"),
        ("2026-09-21", "weekly", "2026-09-21", "2026-09-28"),
        ("2026-09-10", "monthly", "2026-09-10", "2026-10-10"),
        # adiantada (prazo no futuro): só um ciclo a partir do prazo
        ("2026-09-25", "daily", "2026-09-21", "2026-09-26"),
        ("2026-09-25", "weekly", "2026-09-21", "2026-10-02"),
        # atrasada: pula os ciclos perdidos
        ("2026-09-10", "daily", "2026-09-21", "2026-09-22"),
        ("2026-09-10", "weekly", "2026-09-21", "2026-09-24"),
        ("2026-06-15", "monthly", "2026-09-21", "2026-10-15"),
        # sem prazo: conta a partir de hoje
        (None, "daily", "2026-09-21", "2026-09-22"),
        (None, "weekly", "2026-09-21", "2026-09-28"),
        # fim de mês: mantém o dia, limitando ao último do mês
        ("2026-01-31", "monthly", "2026-01-31", "2026-02-28"),
        ("2028-01-31", "monthly", "2028-01-31", "2028-02-29"),  # bissexto
        ("2026-03-31", "monthly", "2026-05-02", "2026-05-31"),  # pula abril, volta ao 31
        # virada de ano
        ("2026-12-31", "daily", "2026-12-31", "2027-01-01"),
        ("2026-12-15", "monthly", "2026-12-15", "2027-01-15"),
    ],
)
def test_next_occurrence(prazo, padrao, hoje, esperado):
    assert next_occurrence(D(prazo) if prazo else None, padrao, D(hoje)) == D(esperado)


def test_next_occurrence_sempre_depois_de_hoje():
    for padrao in ("daily", "weekly", "monthly"):
        for prazo in ("2026-01-01", "2026-09-21", "2027-05-05"):
            assert next_occurrence(D(prazo), padrao, D("2026-09-21")) > D("2026-09-21")


def test_next_occurrence_padrao_invalido():
    with pytest.raises(ValueError):
        next_occurrence(D("2026-09-21"), "yearly", D("2026-09-21"))


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("Tomar vitamina todo dia às 08:00", "daily"),
        ("Tomar vitamina todos os dias", "daily"),
        ("Regar as plantas diariamente", "daily"),
        ("Alongar toda manhã", "daily"),
        ("Toda segunda-feira levar o Léo na natação", "weekly"),
        ("Reunião toda terça", "weekly"),
        ("Aula de inglês toda sexta às 19h", "weekly"),
        ("Feira todo sábado", "weekly"),
        ("Yoga todas as quartas", "weekly"),
        ("Faxina toda semana", "weekly"),
        ("Pagar aluguel todo dia 10", "monthly"),
        ("Pagar a escola todo dia 5 do mês", "monthly"),
        ("Pagar condomínio todo mês", "monthly"),
        ("Revisar orçamento mensalmente", "monthly"),
        # sem repetição
        ("Comprar leite amanhã", None),
        ("Dentista sexta 15h", None),
        ("Ligar para a vovó dia 15", None),
        ("", None),
        # 'todo dia 8h' é horário, não dia do mês
        ("Tomar remédio todo dia 8h", "daily"),
        ("Tomar remédio todo dia 08:30", "daily"),
        # dia do mês inválido cai no diário (o "todo dia" ainda está lá)
        ("Estudar todo dia 45", "daily"),
    ],
)
def test_detect_recurrence(texto, esperado):
    assert detect_recurrence(texto) == esperado


@pytest.mark.parametrize(
    "texto, padrao, hoje, esperado",
    [
        ("Tomar vitamina todo dia", "daily", "2026-09-21", "2026-09-21"),
        ("Natação toda segunda-feira", "weekly", "2026-09-21", "2026-09-21"),  # hoje é segunda
        ("Reunião toda quarta", "weekly", "2026-09-21", "2026-09-23"),
        ("Feira todo sábado", "weekly", "2026-09-21", "2026-09-26"),
        ("Pagar aluguel todo dia 10", "monthly", "2026-09-21", "2026-10-10"),
        ("Pagar aluguel todo dia 25", "monthly", "2026-09-21", "2026-09-25"),
        ("Pagar aluguel todo dia 21", "monthly", "2026-09-21", "2026-09-21"),
        ("Pagar condomínio todo dia 31", "monthly", "2026-09-21", "2026-09-30"),  # setembro tem 30
        ("Revisar orçamento todo mês", "monthly", "2026-09-21", "2026-09-21"),
    ],
)
def test_first_occurrence(texto, padrao, hoje, esperado):
    assert first_occurrence(texto, padrao, D(hoje)) == D(esperado)


@pytest.mark.parametrize("valor, esperado", [
    ("daily", "daily"), ("WEEKLY", "weekly"), (" monthly ", "monthly"),
    ("yearly", None), ("", None), (None, None), (3, None),
])
def test_clean_pattern(valor, esperado):
    assert clean_pattern(valor) == esperado
