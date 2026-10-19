"""Sugestões de tarefa: qualidade antes de quantidade, sem inventar e robustas a respostas ruins da IA."""
from __future__ import annotations

import json
from datetime import date

import pytest

from app import ai
from app.config import settings

HOJE = date(2026, 10, 19)          # segunda-feira
AMANHA, SEXTA = date(2026, 10, 20), date(2026, 10, 23)


def _san(title="Reunião", hoje=HOJE, texto="reunião", **data):
    return ai._sanitize({"title": title, **data}, texto, hoje)


# ----------------------- o prompt -----------------------
def test_prompt_prioriza_qualidade_e_nao_inventar():
    p = ai._SYSTEM
    assert "qualidade antes de quantidade" in p
    assert "0 a 3 passos" in p and "Use 0 para algo simples" in p
    assert "NUNCA devolva passos óbvios" in p and "NÃO invente" in p
    assert "Data vaga" in p and "não invente um dia" in p
    # a regra antiga (sempre 1-2 passos, mesmo em tarefa simples) e a de "dependências reais" saíram
    assert "SEMPRE devolva 1 ou 2" not in p and "apenas quando houver dependências" not in p


@pytest.mark.parametrize("trecho", [
    "Revisar os slides", "Conferir os dados", "Preparar os pontos principais",        # apresentar o projeto
    "Pesquisar sobre a vaga", "Preparar exemplos profissionais", "Conferir horário e local ou link",  # entrevista
    "Reunir os dados", "Redigir o relatório", "Revisar antes de enviar",               # relatório
    "Escolher por qual cômodo começar",                                                  # organizar a casa
])
def test_prompt_traz_os_exemplos_de_antecipacao(trecho):
    assert trecho in ai._SYSTEM


def test_prompt_manda_a_ia_so_dizer_o_que_lembrar_nao_quando():
    p = ai._SYSTEM
    assert "NÃO escreva datas nem horários" in p and "o app calcula" in p
    assert '"kind"' in p and "preparo" in p and "inicio" in p


# ----------------------- passos -----------------------
def test_tarefa_simples_fica_sem_passos():
    assert _san(title="Pagar o boleto", subtasks=[])["subtasks"] == []


def test_no_maximo_tres_passos_na_ordem_dada():
    r = _san(subtasks=["Reunir os dados", "Redigir o relatório", "Revisar antes de enviar", "Marcar um café"])
    assert r["subtasks"] == ["Reunir os dados", "Redigir o relatório", "Revisar antes de enviar"]


@pytest.mark.parametrize("enchimento", [
    "Definir o próximo passo", "Reservar um horário", "reservar tempo", "Começar", "Iniciar a tarefa",
    "Finalizar", "Concluir", "Fazer a tarefa", "Planejar", "Organizar o tempo",
])
def test_passos_de_enchimento_sao_descartados(enchimento):
    assert _san(subtasks=[enchimento, "Revisar os slides"])["subtasks"] == ["Revisar os slides"]


def test_passos_uteis_com_palavras_parecidas_ao_enchimento_sao_mantidos():
    # "Concluir" sozinho é enchimento; "Concluir a revisão dos números" é um passo de verdade
    assert _san(subtasks=["Finalizar a apresentação do trimestre"])["subtasks"] == ["Finalizar a apresentação do trimestre"]


def test_passo_longo_e_cortado_sem_partir_palavra():
    longo = "Preparar uma apresentação muito detalhada com todos os gráficos e números do trimestre"
    (passo,) = _san(subtasks=[longo])["subtasks"]
    assert len(passo) <= ai.MAX_STEP_LEN and longo.startswith(passo) and not passo.endswith(" ")


def test_passos_repetidos_ou_iguais_ao_titulo_somem():
    r = _san(title="Preparar a pauta", subtasks=["preparar a pauta", "Enviar o convite", "Enviar o convite"])
    assert r["subtasks"] == ["Enviar o convite"]


# ----------------------- lembrete: a IA diz O QUE, o servidor decide se e como -----------------------
@pytest.mark.parametrize("kind,data,hora,esperado", [
    ("preparo", AMANHA, None, "preparo"),
    ("preparo", SEXTA, "10:00", "preparo"),
    ("preparo", HOJE, "15:00", "inicio"),     # véspera já passou, mas há horário pela frente
    ("preparo", HOJE, None, None),            # hoje e sem horário: nada a avisar
    ("preparo", date(2026, 10, 10), "09:00", None),   # no passado
    ("inicio", AMANHA, "09:00", "inicio"),
    ("inicio", AMANHA, None, None),           # "pouco antes do horário" sem horário não existe
    ("inicio", date(2026, 10, 10), "09:00", None),
    ("xyz", AMANHA, None, "preparo"),         # tipo desconhecido vira o mais seguro
    (None, AMANHA, None, "preparo"),
    ("preparo", None, None, None),            # sem data, sem lembrete: não se inventa momento
])
def test_reminder_kind(kind, data, hora, esperado):
    assert ai.reminder_kind(kind, data, hora, HOJE) == esperado


def _sug(**extra):
    return {"kind": "preparo", "text": "Quer um lembrete na véspera para rever a pauta?",
            "action": {"title": "Rever a pauta", "category": "reunioes"}, **extra}


def test_lembrete_sai_sem_datas_do_modelo():
    r = _san(due_date=SEXTA.isoformat(), suggestion=_sug(action={
        "title": "Rever a pauta", "category": "reunioes", "due_date": "2026-10-02", "due_time": "03:00"}))
    s = r["suggestion"]
    assert s["kind"] == "preparo" and s["text"].startswith("Quer um lembrete")
    assert s["action"]["due_date"] is None and s["action"]["due_time"] is None   # o app calcula


def test_sem_data_nao_ha_lembrete():
    assert _san(suggestion=_sug())["suggestion"] is None
    assert _san(due_date=None, due_time="10:00", suggestion=_sug())["suggestion"] is None


def test_hoje_com_horario_o_lembrete_vira_de_inicio():
    s = _san(due_date=HOJE.isoformat(), due_time="15:00", suggestion=_sug())["suggestion"]
    assert s["kind"] == "inicio"


def test_hoje_sem_horario_nao_ha_lembrete():
    assert _san(due_date=HOJE.isoformat(), suggestion=_sug())["suggestion"] is None


def test_frase_e_titulo_do_lembrete_sao_curtos():
    r = _san(due_date=SEXTA.isoformat(), suggestion=_sug(
        text="Quer um lembrete\n na véspera " + "para rever a pauta com calma " * 6,
        action={"title": "Revisar com atenção todos os números e gráficos do relatório mensal da diretoria", "category": "trabalho"}))
    s = r["suggestion"]
    assert len(s["text"]) <= ai.MAX_TEXT_LEN and "\n" not in s["text"]
    assert len(s["action"]["title"]) <= ai.MAX_STEP_LEN


def test_lembrete_sem_texto_ou_sem_acao_nao_quebra():
    assert _san(due_date=SEXTA.isoformat(), suggestion=_sug(text="  "))["suggestion"] is None
    s = _san(due_date=SEXTA.isoformat(), suggestion={"kind": "preparo", "text": "Quer um lembrete?"})["suggestion"]
    assert s["action"] is None and s["kind"] == "preparo"


# ----------------------- respostas inconsistentes do modelo -----------------------
@pytest.mark.parametrize("lixo", [None, "texto solto", 42, [], {}, [None, 1, {"a": 1}], [""], ["  ", "\n"]])
def test_subtasks_com_lixo_nao_quebram(lixo):
    assert isinstance(_san(subtasks=lixo)["subtasks"], list)


@pytest.mark.parametrize("lixo", [None, "x", 3, [], ["a"], {"kind": 5, "text": ["a"]}, {"text": None}])
def test_suggestion_com_lixo_nao_quebra(lixo):
    r = _san(due_date=SEXTA.isoformat(), suggestion=lixo)
    assert r["suggestion"] is None or isinstance(r["suggestion"]["text"], str)


def test_resposta_sem_titulo_usa_o_texto_original():
    r = ai._sanitize({"subtasks": ["Revisar os slides"]}, "apresentar o projeto na sexta", HOJE)
    assert r["title"] == "Apresentar o projeto na sexta" and r["subtasks"] == ["Revisar os slides"]


# ----------------------- ponta a ponta: /tasks/smart -----------------------
@pytest.fixture()
def modelo(monkeypatch):
    """Gemini falso: devolve o JSON definido pelo teste."""
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "chave-falsa")
    resposta, corpos = {}, []

    async def _post_falso(body, timeout):
        corpos.append(body)
        return {"candidates": [{"content": {"parts": [{"text": json.dumps(resposta)}]}}]}

    monkeypatch.setattr(ai, "_post", _post_falso)
    return resposta, corpos


def test_smart_entrevista_amanha(client, usuaria, modelo):
    resposta, corpos = modelo
    resposta.update(
        title="Entrevista de emprego", category="carreira", due_date="2026-10-20", due_time=None,
        subtasks=["Pesquisar sobre a vaga", "Preparar exemplos profissionais", "Conferir horário e local ou link"],
        suggestion=_sug(text="Quer um lembrete na véspera para se preparar?", action={"title": "Preparar a entrevista", "category": "carreira"}),
    )
    r = client.post("/tasks/smart", json={"text": "Tenho uma entrevista de emprego amanhã", "today": "2026-10-19"},
                    headers=usuaria["headers"]).json()
    assert r["ai"] is True and len(r["subtasks"]) == 3
    assert r["suggestion"]["kind"] == "preparo" and r["suggestion"]["action"]["due_date"] is None
    # só o texto do pedido e a data de hoje vão para o modelo (nada de tarefas existentes)
    prompt = corpos[0]["contents"][0]["parts"][0]["text"]
    assert "entrevista de emprego" in prompt and "tarefas" not in prompt.lower()


def test_smart_tarefa_simples_sem_passos_e_sem_lembrete(client, usuaria, modelo):
    resposta, _ = modelo
    resposta.update(title="Pagar a academia", category="financas", due_date=None, subtasks=[], suggestion=None)
    r = client.post("/tasks/smart", json={"text": "pagar a academia"}, headers=usuaria["headers"]).json()
    assert r["subtasks"] == [] and r["suggestion"] is None


def test_smart_prazo_proximo_hoje_sem_horario(client, usuaria, modelo):
    resposta, _ = modelo
    resposta.update(title="Entregar o relatório", category="trabalho", due_date="2026-10-19",
                    subtasks=["Revisar antes de enviar"], suggestion=_sug())
    r = client.post("/tasks/smart", json={"text": "entregar o relatório hoje", "today": "2026-10-19"},
                    headers=usuaria["headers"]).json()
    assert r["subtasks"] == ["Revisar antes de enviar"] and r["suggestion"] is None   # não há "véspera" para hoje


def test_smart_json_invalido_cai_no_fallback_marcado(client, usuaria, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "chave-falsa")

    async def _lixo(body, timeout):
        return {"candidates": [{"content": {"parts": [{"text": "isto não é json {"}]}}]}

    monkeypatch.setattr(ai, "_post", _lixo)
    r = client.post("/tasks/smart", json={"text": "comprar pão"}, headers=usuaria["headers"]).json()
    assert r["ai"] is False and r["title"] == "Comprar pão"


# ----------------------- Gemini falha -> Groq -----------------------
def test_gemini_falha_e_o_groq_responde(client, usuaria, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "g")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "q")
    chamadas = {"groq": 0}

    async def _gemini_fora(body, timeout):
        return None

    async def _groq(body, timeout):
        chamadas["groq"] += 1
        conteudo = json.dumps(dict(title="Apresentar o projeto", category="reunioes", due_date="2026-10-23",
                                    subtasks=["Revisar os slides", "Conferir os dados"], suggestion=_sug()))
        return {"choices": [{"message": {"content": conteudo}}]}

    monkeypatch.setattr(ai, "_post", _gemini_fora)
    monkeypatch.setattr(ai, "_post_groq", _groq)
    r = client.post("/tasks/smart", json={"text": "apresentar o projeto na sexta", "today": "2026-10-19"},
                    headers=usuaria["headers"]).json()
    assert chamadas["groq"] == 1 and r["ai"] is True
    assert r["subtasks"] == ["Revisar os slides", "Conferir os dados"] and r["suggestion"]["kind"] == "preparo"


def test_os_dois_provedores_fora_devolvem_fallback(client, usuaria, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "g")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "q")

    async def _fora(body, timeout):
        return None

    monkeypatch.setattr(ai, "_post", _fora)
    monkeypatch.setattr(ai, "_post_groq", _fora)
    r = client.post("/tasks/smart", json={"text": "ligar para o João"}, headers=usuaria["headers"]).json()
    assert r["ai"] is False and r["subtasks"] == [] and r["suggestion"] is None
