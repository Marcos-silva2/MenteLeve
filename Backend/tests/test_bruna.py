"""Bruna: contexto da agenda, quando agir, honestidade sobre o que foi feito e provedor de reserva."""
from __future__ import annotations

import json
from datetime import date, time

import pytest

from app import ai
from app.config import settings
from app.routers import ai_chat

from conftest import auth_headers, registrar

HOJE = "2026-10-19"      # segunda-feira


# ----------------------- helpers -----------------------
def _texto(t):
    return {"candidates": [{"content": {"parts": [{"text": t}]}}]}


def _chamada(nome, args, texto=""):
    partes = ([{"text": texto}] if texto else []) + [{"functionCall": {"name": nome, "args": args}}]
    return {"candidates": [{"content": {"parts": partes}}]}


@pytest.fixture()
def gemini(monkeypatch):
    """Gemini falso: respostas em fila (uma por ida ao modelo); guarda o corpo de cada ida."""
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "chave-falsa")
    fila, corpos = [], []

    async def _post_falso(body, timeout):
        corpos.append(body)
        return fila.pop(0) if fila else None

    monkeypatch.setattr(ai, "_post", _post_falso)
    return fila, corpos


def _conversar(client, user, texto, hoje=HOJE):
    r = client.post("/ai/chat", json={"messages": [{"role": "user", "content": texto}], "today": hoje}, headers=user["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _sistema(corpo):
    return corpo["system_instruction"]["parts"][0]["text"]


def _tarefa(client, user, titulo, **campos):
    r = client.post("/tasks", json={"title": titulo, **campos}, headers=user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


# ----------------------- o prompt da Bruna -----------------------
def test_prompt_define_quando_agir_perguntar_e_ser_honesta():
    p = ai._CHAT_SYSTEM
    assert "no máximo 3 frases curtas" in p
    assert "Pedido claro -> aja, sem pedir confirmação" in p
    assert "UMA pergunta curta" in p and "'Para quando?'" in p
    assert "nunca faça mais de uma pergunta" in p
    assert "HONESTIDADE" in p and "nunca diga que anotou" in p
    assert "NUNCA cite tarefa que não esteja nessa lista" in p
    assert "Não invente tarefas, datas, horários, nomes nem dados" in p


def test_chat_system_sem_agenda_nao_acrescenta_nada():
    s = ai._chat_system(date(2026, 10, 19))
    assert "Tarefas em aberto" not in s and "19/10/2026" in s


def test_chat_system_com_agenda_vazia_diz_que_nao_ha_nada():
    assert "não tem nenhuma atrasada nem para os próximos 7 dias" in ai._chat_system(date(2026, 10, 19), [])


def test_chat_system_com_agenda_lista_as_tarefas():
    s = ai._chat_system(date(2026, 10, 19), ["- 20/10 10:00 — Reunião"])
    assert "Tarefas em aberto" in s and "- 20/10 10:00 — Reunião" in s


# ----------------------- a agenda enviada como contexto -----------------------
class _T:   # tarefa mínima para testar a função pura
    def __init__(self, id, title, due_date=None, due_time=None, parent_id=None):
        self.id, self.title, self.due_date, self.due_time, self.parent_id = id, title, due_date, due_time, parent_id


def _d(dia):
    return date(2026, 10, dia)


def test_agenda_ordena_marca_atrasadas_e_corta_o_horizonte():
    hoje = _d(19)
    linhas = ai_chat.agenda_context([
        _T(1, "Dentista", _d(21), "17:30"),
        _T(2, "Reunião", _d(21), "09:00"),
        _T(3, "Boleto", _d(15)),                      # atrasada
        _T(4, "Sem data"),                            # não entra
        _T(5, "Longe", _d(30)),                       # além de 7 dias
        _T(6, "Subtarefa", _d(20), parent_id=2),      # subtarefa não entra
        _T(7, "No limite", _d(26)),                   # exatamente 7 dias: entra
    ], hoje)
    assert linhas == [
        "- 15/10 (atrasada) — Boleto",
        "- 21/10 09:00 — Reunião",
        "- 21/10 17:30 — Dentista",
        "- 26/10 — No limite",
    ]


def test_agenda_limita_linhas_e_resume_o_resto():
    linhas = ai_chat.agenda_context([_T(i, f"T{i}", _d(20)) for i in range(1, 16)], _d(19))
    assert len(linhas) == ai_chat._AGENDA_MAX + 1 and linhas[-1] == "- (+3 outras tarefas)"


def test_agenda_corta_titulo_longo_e_quebras_de_linha():
    (linha,) = ai_chat.agenda_context([_T(1, "x\n" * 100, _d(20))], _d(19))
    assert "\n" not in linha and len(linha) <= len("- 20/10 — ") + ai_chat._AGENDA_TITLE_MAX


def test_agenda_vazia():
    assert ai_chat.agenda_context([], _d(19)) == []


def test_so_a_agenda_da_propria_pessoa_vai_ao_modelo(client, usuaria, gemini):
    fila, corpos = gemini
    _tarefa(client, usuaria, "Reunião com o cliente", due_date="2026-10-20", due_time="10:00")
    outra = registrar(client, email="outra@example.com", name="Outra")
    _tarefa(client, {"headers": auth_headers(outra["access_token"])}, "Segredo da outra pessoa", due_date="2026-10-20")
    fila.append(_texto("Amanhã você tem uma reunião às 10h."))
    r = _conversar(client, usuaria, "o que tenho amanhã?")
    s = _sistema(corpos[0])
    assert "- 20/10 10:00 — Reunião com o cliente" in s and "Segredo da outra pessoa" not in s
    assert r["reply"] == "Amanhã você tem uma reunião às 10h."


def test_tarefa_de_espaco_compartilhado_entra_na_agenda_dos_membros(client, usuaria, gemini):
    fila, corpos = gemini
    espaco = client.post("/spaces", json={"name": "Equipe"}, headers=usuaria["headers"]).json()
    _tarefa(client, usuaria, "Kickoff", due_date="2026-10-21", space_id=espaco["id"])
    fila.append(_texto("ok"))
    _conversar(client, usuaria, "e a semana?")
    assert "— Kickoff" in _sistema(corpos[0])


# ----------------------- honestidade: nunca dizer que fez o que não fez -----------------------
@pytest.mark.parametrize("mentira", [
    "Pronto, anotei isso para você!", "Criei a tarefa para amanhã.", "Já adicionei na sua agenda ✨",
    "Marquei como concluída!", "Agendei para sexta às 10h.", "Concluí a tarefa do relatório.",
    "Deixei marcado para você.", "Registrei o lembrete.",
])
def test_resposta_que_diz_ter_feito_sem_chamar_funcao_e_trocada(client, usuaria, gemini, mentira):
    fila, _ = gemini
    fila.append(_texto(mentira))
    r = _conversar(client, usuaria, "me lembra de ligar para o João")
    assert r["reply"] == ai_chat._NAO_FEITO and r["tasks"] == []
    assert client.get("/tasks", headers=usuaria["headers"]).json() == []


@pytest.mark.parametrize("ok", [
    "Para quando você quer que eu lembre?", "Se quiser, eu anoto isso para você.",
    "Posso agendar assim que você me disser o dia.", "Você tem 2 tarefas amanhã: a reunião e o dentista.",
    "Que tal começar pela mais curta?",
])
def test_resposta_normal_passa_intacta(client, usuaria, gemini, ok):
    fila, _ = gemini
    fila.append(_texto(ok))
    assert _conversar(client, usuaria, "oi")["reply"] == ok


def test_claims_done_detecta_so_o_passado_na_primeira_pessoa():
    assert ai_chat.claims_done("Anotei aqui!") and ai_chat.claims_done("CRIEI a tarefa") and ai_chat.claims_done("Concluí")
    assert not ai_chat.claims_done("posso anotar?") and not ai_chat.claims_done("vou criar agora") and not ai_chat.claims_done("")


def test_falha_da_funcao_nao_vira_comemoracao(client, usuaria, gemini):
    fila, _ = gemini
    # pede para concluir algo que não existe; na volta o modelo "comemora" mesmo assim
    fila.append(_chamada("concluir_tarefa", {"titulo": "relatório inexistente"}))
    fila.append(_texto("Marquei o relatório como concluído, parabéns!"))
    r = _conversar(client, usuaria, "terminei o relatório")
    assert r["reply"] == ai_chat._NAO_FEITO and r["tasks"] == []


def test_nao_encontrada_com_resposta_honesta_do_modelo_e_mantida(client, usuaria, gemini):
    fila, _ = gemini
    fila.append(_chamada("concluir_tarefa", {"titulo": "relatório inexistente"}))
    fila.append(_texto("Não achei essa tarefa em aberto. Qual é o nome dela?"))
    assert _conversar(client, usuaria, "terminei o relatório")["reply"] == "Não achei essa tarefa em aberto. Qual é o nome dela?"


# ----------------------- executar ações -----------------------
def test_criar_tarefa_confirma_o_que_foi_criado(client, usuaria, gemini):
    fila, _ = gemini
    fila.append(_chamada("criar_tarefa", {"titulo": "Reunião com o cliente", "categoria": "reunioes",
                                           "due_date": "2026-10-20", "due_time": "10:00", "hora_fim": "11:00"}))
    r = _conversar(client, usuaria, "marca reunião com o cliente amanhã das 10h às 11h")
    assert r["reply"] == "Anotei “Reunião com o cliente” ✨"
    (t,) = r["tasks"]
    assert (t["category"], t["due_date"], t["due_time"], t["end_time"]) == ("reunioes", "2026-10-20", "10:00", "11:00")


def test_pedido_repetido_nao_duplica_e_nao_finge_que_criou(client, usuaria, gemini):
    fila, _ = gemini
    args = {"titulo": "Ligar para o João", "due_date": "2026-10-20"}
    fila.extend([_chamada("criar_tarefa", args), _chamada("criar_tarefa", args)])
    assert _conversar(client, usuaria, "anota ligar para o João amanhã")["reply"] == "Anotei “Ligar para o João” ✨"
    segunda = _conversar(client, usuaria, "anota ligar para o João amanhã")["reply"]
    assert "já estava na sua lista" in segunda and "Anotei" not in segunda
    assert len(client.get("/tasks", headers=usuaria["headers"]).json()) == 1


def test_dados_ruins_do_modelo_viram_valores_seguros(client, usuaria, gemini):
    fila, _ = gemini
    fila.append(_chamada("criar_tarefa", {"titulo": "Comprar pão", "categoria": "inventada",
                                           "due_date": "amanhã cedo", "due_time": "25:99", "hora_fim": "ontem"}))
    (t,) = _conversar(client, usuaria, "anota comprar pão")["tasks"]
    assert t["category"] == "casa" and t["due_date"] is None and t["due_time"] is None and t["end_time"] is None


def test_titulo_vazio_nao_cria_nada(client, usuaria, gemini):
    fila, _ = gemini
    fila.append(_chamada("criar_tarefa", {"titulo": "   "}))
    fila.append(_texto("Qual é a tarefa?"))
    r = _conversar(client, usuaria, "anota")
    assert r["tasks"] == [] and client.get("/tasks", headers=usuaria["headers"]).json() == []


def test_concluir_tarefa_existente(client, usuaria, gemini):
    fila, _ = gemini
    _tarefa(client, usuaria, "Enviar o relatório mensal")
    fila.append(_chamada("concluir_tarefa", {"titulo": "relatório"}))
    r = _conversar(client, usuaria, "terminei o relatório")
    assert r["reply"].startswith("Marquei “Enviar o relatório mensal” como concluída")
    assert r["tasks"][0]["done"] is True


def test_concluir_ambiguo_pergunta_em_vez_de_escolher(client, usuaria, gemini):
    fila, _ = gemini
    _tarefa(client, usuaria, "Revisar relatório de vendas")
    _tarefa(client, usuaria, "Revisar relatório de custos")
    fila.append(_chamada("concluir_tarefa", {"titulo": "revisar relatório"}))
    fila.append(_texto("Qual delas: vendas ou custos?"))
    r = _conversar(client, usuaria, "terminei de revisar o relatório")
    assert r["reply"] == "Qual delas: vendas ou custos?" and r["tasks"] == []
    assert all(t["done"] is False for t in client.get("/tasks", headers=usuaria["headers"]).json())


def test_sem_nenhuma_ia_devolve_a_mensagem_de_reserva(client, usuaria, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    r = _conversar(client, usuaria, "oi")
    assert r["reply"] == ai_chat._FALLBACK and r["tasks"] == []


# ----------------------- Gemini falha -> Groq -----------------------
def test_chat_cai_no_groq_quando_o_gemini_falha_e_ainda_age(client, usuaria, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "g")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "q")
    corpos = []

    async def _gemini_fora(body, timeout):
        return None

    async def _groq(body, timeout):
        corpos.append(body)
        return {"choices": [{"message": {"content": "", "tool_calls": [{
            "id": "call_1", "type": "function",
            "function": {"name": "criar_tarefa", "arguments": json.dumps({"titulo": "Dentista", "due_date": "2026-10-21"})}}]}}]}

    monkeypatch.setattr(ai, "_post", _gemini_fora)
    monkeypatch.setattr(ai, "_post_groq", _groq)
    _tarefa(client, usuaria, "Reunião", due_date="2026-10-20")
    r = _conversar(client, usuaria, "anota dentista quarta")
    assert r["reply"] == "Anotei “Dentista” ✨" and r["tasks"][0]["due_date"] == "2026-10-21"
    # o Groq também recebe a agenda como contexto
    assert "- 20/10 — Reunião" in corpos[0]["messages"][0]["content"]
