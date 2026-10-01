"""Prompts da IA: contexto de vida + trabalho e categorias coerentes com o app."""
from __future__ import annotations

from datetime import date

import pytest

from app import ai
from app.categories import CATEGORIES, LEGACY_CATEGORIES, LIFE, WORK


def test_grupos_cobrem_todas_as_categorias_sem_repetir():
    assert set(WORK) | set(LIFE) == set(CATEGORIES)
    assert not set(WORK) & set(LIFE)
    assert len(CATEGORIES) == len(set(CATEGORIES))


@pytest.mark.parametrize("categoria", CATEGORIES)
def test_prompt_de_analise_explica_cada_categoria(categoria):
    # uma vez na lista do formato e outra na descrição de cada categoria
    assert ai._SYSTEM.count(categoria) >= 2


def test_prompts_nao_presumem_publico_nem_genero():
    for texto in (ai._SYSTEM, ai._CHAT_SYSTEM):
        for termo in ("mães", "mulheres", "usuária"):
            assert termo not in texto, termo


def test_prompt_de_analise_tem_exemplos_de_trabalho():
    for termo in ("reunião", "relatório", "pauta", "currículo"):
        assert termo in ai._SYSTEM


def test_bruna_cobre_trabalho_e_protege_dados_do_trabalho():
    assert "trabalho" in ai._CHAT_SYSTEM and "vida pessoal" in ai._CHAT_SYSTEM
    assert "confidenciais de trabalho" in ai._CHAT_SYSTEM
    assert "ciclo menstrual" in ai._CHAT_SYSTEM  # a regra de privacidade continua


def test_ferramenta_da_bruna_aceita_so_as_categorias_atuais():
    criar = next(s for s in ai._TOOL_SPECS if s["name"] == "criar_tarefa")
    assert criar["parameters"]["properties"]["categoria"]["enum"] == list(CATEGORIES)


@pytest.mark.parametrize("categoria", CATEGORIES)
def test_sanitize_aceita_categorias_novas(categoria):
    r = ai._sanitize({"title": "x", "category": categoria}, "x", date(2026, 10, 1))
    assert r["category"] == categoria


@pytest.mark.parametrize("antiga,atual", list(LEGACY_CATEGORIES.items()))
def test_sanitize_converte_categoria_antiga_dita_pelo_modelo(antiga, atual):
    r = ai._sanitize(
        {"title": "x", "category": antiga, "suggestion": {"text": "ok", "action": {"title": "y", "category": antiga}}},
        "x", date(2026, 10, 1),
    )
    assert r["category"] == atual
    assert r["suggestion"]["action"]["category"] == atual


def test_sanitize_categoria_invalida_cai_na_padrao():
    assert ai._sanitize({"title": "x", "category": "lixo"}, "x", date(2026, 10, 1))["category"] == "casa"
