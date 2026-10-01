"""Recorrência avançada: dias específicos da semana, dias úteis e fim da série."""
from __future__ import annotations

from datetime import date

import pytest

from app import ai
from app.recurrence import (
    clean_weekdays, detect_recurrence, detect_until, detect_weekdays, first_occurrence,
    next_occurrence, resolve,
)

# 01/10/2026 é uma quinta-feira (weekday 3).
QUI = date(2026, 10, 1)
SEX, SAB, DOM, SEG, TER, QUA = (date(2026, 10, d) for d in (2, 3, 4, 5, 6, 7))
UTEIS = [0, 1, 2, 3, 4]


# ----------------------- clean_weekdays -----------------------
@pytest.mark.parametrize("entrada,esperado", [
    ([4, 0, 2, 2], [0, 2, 4]),
    ("0,2,4", [0, 2, 4]),
    ([], None),
    ("", None),
    ([0, 1, 2, 3, 4, 5, 6], None),  # todos os dias = diário, não semanal
    ([7], None),
    (["x"], None),
    (None, None),
])
def test_clean_weekdays(entrada, esperado):
    assert clean_weekdays(entrada) == esperado


# ----------------------- next_occurrence -----------------------
def test_dias_uteis_de_quinta_vai_para_sexta_e_de_sexta_pula_o_fim_de_semana():
    assert next_occurrence(QUI, "weekly", QUI, UTEIS) == SEX
    assert next_occurrence(SEX, "weekly", SEX, UTEIS) == SEG


def test_seg_qua_sex():
    assert next_occurrence(SEG, "weekly", SEG, [0, 2, 4]) == QUA
    assert next_occurrence(QUA, "weekly", QUA, [0, 2, 4]) == date(2026, 10, 9)    # sexta
    assert next_occurrence(date(2026, 10, 9), "weekly", date(2026, 10, 9), [0, 2, 4]) == date(2026, 10, 12)


def test_atrasada_cai_no_primeiro_dia_valido_depois_de_hoje():
    # prazo era segunda passada; hoje é quinta -> próxima ocorrência é sexta
    assert next_occurrence(date(2026, 9, 28), "weekly", QUI, UTEIS) == SEX


def test_adiantada_conta_a_partir_do_prazo():
    # concluída na quinta uma ocorrência marcada para segunda -> próxima é terça
    assert next_occurrence(SEG, "weekly", QUI, UTEIS) == TER


def test_sem_dias_especificos_o_semanal_continua_igual():
    assert next_occurrence(QUI, "weekly", QUI) == date(2026, 10, 8)
    assert next_occurrence(QUI, "weekly", QUI, None) == date(2026, 10, 8)


def test_fim_da_serie():
    assert next_occurrence(QUI, "daily", QUI, until=SEX) == SEX
    assert next_occurrence(SEX, "daily", SEX, until=SEX) is None
    assert next_occurrence(SEX, "weekly", SEX, UTEIS, until=SAB) is None  # próxima seria segunda
    assert next_occurrence(QUI, "monthly", QUI, until=date(2026, 10, 31)) is None


# ----------------------- first_occurrence -----------------------
def test_primeira_ocorrencia_com_dias_especificos():
    assert first_occurrence("", "weekly", QUI, UTEIS) == QUI       # hoje já vale
    assert first_occurrence("", "weekly", SAB, UTEIS) == SEG       # sábado -> segunda
    assert first_occurrence("", "weekly", QUI, [0, 2]) == SEG


# ----------------------- detecção -----------------------
@pytest.mark.parametrize("texto,dias", [
    ("daily às 9h nos dias úteis", UTEIS),
    ("Responder e-mails todo dia útil", UTEIS),
    ("academia de segunda a sexta", UTEIS),
    ("aula de inglês de terça a quinta", [1, 2, 3]),
    ("plantão de sexta a domingo", [4, 5, 6]),
    ("reunião toda segunda e quarta", [0, 2]),
    ("treino às segundas, quartas e sextas", [0, 2, 4]),
    ("pilates todas as terças e quintas", [1, 3]),
])
def test_detecta_dias_especificos(texto, dias):
    assert detect_weekdays(texto) == dias
    assert detect_recurrence(texto) == "weekly"


@pytest.mark.parametrize("texto", [
    "reunião toda segunda às 9h",       # um dia só: semanal simples
    "comprar pão",                      # nem recorrente
    "ligar para a mãe na segunda",      # cita um dia, mas não repete
    "entregar relatório segunda e sexta",  # dois dias sem pedido de repetição
])
def test_nao_inventa_dias_especificos(texto):
    assert detect_weekdays(texto) is None


@pytest.mark.parametrize("texto,fim", [
    ("academia todo dia até 20/12", date(2026, 12, 20)),
    ("tomar remédio todo dia até 5/10", date(2026, 10, 5)),
    ("aula toda terça até 10/03", date(2027, 3, 10)),        # março já passou: ano que vem
    ("estágio de segunda a sexta até 31/01/2027", date(2027, 1, 31)),
    ("curso toda quarta até 15 de dezembro", date(2026, 12, 15)),
    ("plantão todo sábado até dezembro", date(2026, 12, 31)),
    ("revisão mensal até fevereiro de 2027", date(2027, 2, 28)),
])
def test_detecta_fim_da_serie(texto, fim):
    assert detect_until(texto, QUI) == fim


def test_sem_fim_dito():
    assert detect_until("reunião toda segunda", QUI) is None
    assert detect_until("até amanhã", QUI) is None


def test_resolve_junta_tudo():
    r = resolve("daily do time às 9h nos dias úteis até 20/12", SAB)
    assert r == {"is_recurring": True, "recurrence_pattern": "weekly", "recurrence_weekdays": UTEIS,
                 "recurrence_until": date(2026, 12, 20), "due_date": SEG}


def test_resolve_ia_informou_dias_mas_esqueceu_o_padrao():
    r = resolve("algo", QUI, pattern=None, weekdays=[0, 2])
    assert r["recurrence_pattern"] == "weekly" and r["recurrence_weekdays"] == [0, 2]


def test_resolve_dias_invalidos_da_ia_sao_ignorados():
    r = resolve("reunião toda segunda", QUI, pattern="weekly", weekdays=[9])
    assert r["recurrence_weekdays"] is None and r["recurrence_pattern"] == "weekly"


def test_resolve_texto_comum():
    assert resolve("comprar pão", QUI)["is_recurring"] is False


def test_sanitize_da_ia_repassa_dias_e_fim():
    r = ai._sanitize(
        {"title": "Daily", "recurrence_pattern": "weekly", "recurrence_weekdays": [0, 1, 2, 3, 4],
         "recurrence_until": "2026-12-20", "due_time": "09:00"},
        "daily às 9h", QUI,
    )
    assert r["recurrence_weekdays"] == UTEIS and r["recurrence_until"] == date(2026, 12, 20)
    assert r["due_date"] == QUI


# ----------------------- API -----------------------
def _criar(client, headers, **campos):
    r = client.post("/tasks", json={"title": "Daily", **campos}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_api_persiste_dias_e_fim(client, usuaria):
    t = _criar(client, usuaria["headers"], due_date="2026-10-01", recurrence_weekdays=[4, 0, 2],
               recurrence_until="2026-12-20")
    assert t["is_recurring"] is True and t["recurrence_pattern"] == "weekly"
    assert t["recurrence_weekdays"] == [0, 2, 4] and t["recurrence_until"] == "2026-12-20"
    lista = client.get("/tasks", headers=usuaria["headers"]).json()
    assert lista[0]["recurrence_weekdays"] == [0, 2, 4]


def test_api_concluir_rola_para_o_proximo_dia_util(client, usuaria):
    t = _criar(client, usuaria["headers"], due_date="2026-10-02", recurrence_weekdays=UTEIS)
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-10-02", headers=usuaria["headers"]).json()
    assert r["due_date"] == "2026-10-05" and r["done"] is False


def test_api_concluir_a_ultima_ocorrencia_fecha_a_tarefa(client, usuaria):
    t = _criar(client, usuaria["headers"], due_date="2026-10-02", recurrence_pattern="daily",
               recurrence_until="2026-10-02")
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-10-02", headers=usuaria["headers"]).json()
    assert r["done"] is True and r["due_date"] == "2026-10-02"


@pytest.mark.parametrize("corpo", [
    {"recurrence_pattern": "daily", "recurrence_weekdays": [0, 2]},  # dias só no semanal
    {"recurrence_weekdays": [8]},
])
def test_api_recusa_combinacoes_invalidas(client, usuaria, corpo):
    assert client.post("/tasks", json={"title": "x", **corpo}, headers=usuaria["headers"]).status_code == 422


def test_api_tarefa_comum_ignora_fim(client, usuaria):
    t = _criar(client, usuaria["headers"], recurrence_until="2026-12-20")
    assert t["is_recurring"] is False and t["recurrence_until"] is None


def test_api_editar_recorrencia_depois_de_criada(client, usuaria):
    h = usuaria["headers"]
    t = _criar(client, h, due_date="2026-10-01")
    assert t["is_recurring"] is False

    r = client.patch(f"/tasks/{t['id']}", json={"recurrence_weekdays": UTEIS, "recurrence_until": "2026-12-20"}, headers=h).json()
    assert r["is_recurring"] is True and r["recurrence_pattern"] == "weekly" and r["recurrence_weekdays"] == UTEIS

    r = client.patch(f"/tasks/{t['id']}", json={"recurrence_pattern": "monthly"}, headers=h).json()
    assert r["recurrence_pattern"] == "monthly" and r["recurrence_weekdays"] is None  # dias só valem no semanal
    assert r["recurrence_until"] == "2026-12-20"

    r = client.patch(f"/tasks/{t['id']}", json={"is_recurring": False}, headers=h).json()
    assert r["is_recurring"] is False and r["recurrence_pattern"] is None
    assert r["recurrence_weekdays"] is None and r["recurrence_until"] is None


def test_smart_sem_ia_detecta_dias_uteis(client, usuaria):
    r = client.post("/tasks/smart", json={"text": "daily do time às 9h nos dias úteis", "today": "2026-10-03"},
                    headers=usuaria["headers"]).json()
    assert r["ai"] is False
    assert r["recurrence_pattern"] == "weekly" and r["recurrence_weekdays"] == UTEIS
