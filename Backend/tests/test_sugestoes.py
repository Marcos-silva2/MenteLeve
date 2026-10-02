"""Sugestões da Bruna: pedidas para toda tarefa e sempre simples (curtas, no máximo 2 passos)."""
from __future__ import annotations

from datetime import date

import pytest

from app import ai


def _san(**data):
    return ai._sanitize({"title": "Reunião", **data}, "reunião", date(2026, 10, 1))


def test_prompt_pede_sugestao_para_toda_tarefa_e_simples():
    p = ai._SYSTEM
    assert "SEMPRE devolva 1 ou 2 subtarefas" in p and "TODA tarefa" in p
    assert "até 5 palavras" in p and "nunca mais de 2 passos" in p
    assert "apenas quando houver dependências" not in p      # a regra antiga, que deixava tarefas sem nada
    assert "CURTOS" in p


def test_no_maximo_dois_passos():
    r = _san(subtasks=["Preparar a pauta", "Enviar o convite", "Registrar a ata", "Marcar o café"])
    assert r["subtasks"] == ["Preparar a pauta", "Enviar o convite"]


def test_passo_longo_e_cortado_sem_partir_palavra():
    longo = "Preparar uma apresentação muito detalhada com todos os gráficos e números do trimestre"
    (passo,) = _san(subtasks=[longo])["subtasks"]
    assert len(passo) <= ai.MAX_STEP_LEN and longo.startswith(passo)
    assert not passo.endswith(" ") and passo.split()[-1] in longo.split()


def test_passos_repetidos_ou_iguais_ao_titulo_somem():
    r = _san(title="Preparar a pauta", subtasks=["preparar a pauta", "Enviar o convite", "Enviar o convite"])
    assert r["subtasks"] == ["Enviar o convite"]


def test_frase_do_lembrete_e_curta_e_em_uma_linha():
    r = _san(suggestion={"text": "Quer um lembrete\n na véspera " + "para rever a pauta com calma " * 6,
                         "action": {"title": "Rever a pauta", "due_date": "2026-10-01"}})
    assert len(r["suggestion"]["text"]) <= ai.MAX_TEXT_LEN and "\n" not in r["suggestion"]["text"]
    assert r["suggestion"]["action"]["title"] == "Rever a pauta"


def test_titulo_do_lembrete_e_curto():
    r = _san(suggestion={"text": "Quer um lembrete?", "action": {"title": "Revisar com atenção todos os números e gráficos do relatório mensal"}})
    assert len(r["suggestion"]["action"]["title"]) <= ai.MAX_STEP_LEN


@pytest.mark.parametrize("entrada", [None, [], [""], ["  "], "texto solto"])
def test_sem_passos_validos_volta_lista_vazia_sem_quebrar(entrada):
    # O preenchimento com passos padrão é do frontend (suggestions.js); aqui só não pode quebrar.
    assert isinstance(_san(subtasks=entrada)["subtasks"], list)
