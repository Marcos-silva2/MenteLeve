"""Tarefas: CRUD, limite do plano gratuito, /tasks/smart e recorrência."""
from __future__ import annotations

import json

import pytest

from app import ai
from app.config import settings
from app.schemas import FREE_TASK_LIMIT

from conftest import auth_headers, registrar


def _criar(client, headers, **campos):
    corpo = {"title": "Comprar pão", **campos}
    r = client.post("/tasks", json=corpo, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ----------------------- CRUD -----------------------
def test_criar_e_listar(client, usuaria):
    t = _criar(client, usuaria["headers"], title="Vacina do Léo", category="saude",
               due_date="2026-09-25", due_time="09:30", important=True)
    assert t["title"] == "Vacina do Léo"
    assert t["category"] == "saude"
    assert t["due_date"] == "2026-09-25"
    assert t["due_time"] == "09:30"
    assert t["important"] is True
    assert t["done"] is False
    assert t["user_id"] == usuaria["user"]["id"]

    lista = client.get("/tasks", headers=usuaria["headers"]).json()
    assert [x["id"] for x in lista] == [t["id"]]


def test_valores_padrao_da_tarefa(client, usuaria):
    t = _criar(client, usuaria["headers"])
    assert t["category"] == "casa"
    assert t["due_date"] is None and t["due_time"] is None
    assert t["is_recurring"] is False and t["recurrence_pattern"] is None


@pytest.mark.parametrize(
    "corpo",
    [
        {"title": ""},
        {"title": "x", "category": "inexistente"},
        {"title": "x", "due_time": "25:99"},
        {"title": "x", "due_date": "amanhã"},
    ],
)
def test_criar_com_dados_invalidos_da_422(client, usuaria, corpo):
    assert client.post("/tasks", json=corpo, headers=usuaria["headers"]).status_code == 422


def test_atualizar_parcialmente(client, usuaria):
    t = _criar(client, usuaria["headers"])
    r = client.patch(f"/tasks/{t['id']}", json={"title": "Comprar pão integral", "important": True}, headers=usuaria["headers"])
    assert r.status_code == 200
    assert r.json()["title"] == "Comprar pão integral"
    assert r.json()["important"] is True
    assert r.json()["category"] == "casa"  # o que não foi enviado não muda


def test_concluir_e_reabrir(client, usuaria):
    t = _criar(client, usuaria["headers"])
    assert client.put(f"/tasks/{t['id']}/complete", headers=usuaria["headers"]).json()["done"] is True
    assert client.put(f"/tasks/{t['id']}/uncomplete", headers=usuaria["headers"]).json()["done"] is False


def test_excluir(client, usuaria):
    t = _criar(client, usuaria["headers"])
    assert client.delete(f"/tasks/{t['id']}", headers=usuaria["headers"]).status_code == 204
    assert client.get("/tasks", headers=usuaria["headers"]).json() == []
    assert client.delete(f"/tasks/{t['id']}", headers=usuaria["headers"]).status_code == 404


def test_excluir_a_mae_remove_as_subtarefas(client, usuaria):
    mae = _criar(client, usuaria["headers"], title="Festa do Léo")
    _criar(client, usuaria["headers"], title="Encomendar bolo", parent_id=mae["id"])
    _criar(client, usuaria["headers"], title="Mandar convites", parent_id=mae["id"])
    client.delete(f"/tasks/{mae['id']}", headers=usuaria["headers"])
    assert client.get("/tasks", headers=usuaria["headers"]).json() == []


def test_uma_usuaria_nao_acessa_tarefas_de_outra(client, usuaria):
    t = _criar(client, usuaria["headers"])
    outra = registrar(client, email="bia@example.com")
    h2 = auth_headers(outra["access_token"])

    assert client.get("/tasks", headers=h2).json() == []
    assert client.patch(f"/tasks/{t['id']}", json={"title": "roubada"}, headers=h2).status_code == 404
    assert client.put(f"/tasks/{t['id']}/complete", headers=h2).status_code == 404
    assert client.delete(f"/tasks/{t['id']}", headers=h2).status_code == 404
    # A original segue intacta.
    assert client.get("/tasks", headers=usuaria["headers"]).json()[0]["title"] == "Comprar pão"


# ----------------------- limite do plano gratuito -----------------------
def test_limite_de_50_tarefas_no_plano_gratuito(client, usuaria):
    assert FREE_TASK_LIMIT == 50
    for i in range(FREE_TASK_LIMIT):
        _criar(client, usuaria["headers"], title=f"Tarefa {i}")

    r = client.post("/tasks", json={"title": "a 51ª"}, headers=usuaria["headers"])
    assert r.status_code == 402
    assert "50" in r.json()["detail"]
    assert len(client.get("/tasks", headers=usuaria["headers"]).json()) == FREE_TASK_LIMIT


def test_premium_nao_tem_limite(client, usuaria):
    assert client.post("/auth/me/premium/simulate", headers=usuaria["headers"]).json()["is_premium"] is True
    for i in range(FREE_TASK_LIMIT + 2):
        _criar(client, usuaria["headers"], title=f"Tarefa {i}")
    assert len(client.get("/tasks", headers=usuaria["headers"]).json()) == FREE_TASK_LIMIT + 2


def test_smart_tambem_respeita_o_limite_gratuito(client, usuaria):
    for i in range(FREE_TASK_LIMIT):
        _criar(client, usuaria["headers"], title=f"Tarefa {i}")
    r = client.post("/tasks/smart", json={"text": "mais uma"}, headers=usuaria["headers"])
    assert r.status_code == 402


# ----------------------- /tasks/smart -----------------------
@pytest.fixture()
def gemini(monkeypatch):
    """Liga o Gemini com um `_post` falso — sem rede. Devolve uma função que
    define o JSON que o "modelo" responderá."""
    monkeypatch.setattr(settings, "GOOGLE_AI_API_KEY", "chave-falsa-de-teste")
    resposta: dict = {}
    chamadas: list[dict] = []

    async def _post_falso(body, timeout):
        chamadas.append(body)
        return {"candidates": [{"content": {"parts": [{"text": json.dumps(resposta)}]}}]}

    monkeypatch.setattr(ai, "_post", _post_falso)

    def definir(**campos):
        resposta.clear()
        resposta.update(campos)
        return chamadas

    return definir


def test_smart_sem_ia_devolve_fallback_marcado(client, usuaria):
    r = client.post("/tasks/smart", json={"text": "comprar leite"}, headers=usuaria["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["ai"] is False
    assert body["title"] == "Comprar leite"
    assert body["category"] == "casa"
    assert body["is_recurring"] is False and body["recurrence_pattern"] is None
    # /tasks/smart não persiste nada.
    assert client.get("/tasks", headers=usuaria["headers"]).json() == []


def test_smart_com_ia_extrai_campos(client, usuaria, gemini):
    gemini(title="dentista", category="saude", due_date="2026-09-25", due_time="15:00",
           subtasks=["Confirmar horário"], suggestion=None)
    r = client.post("/tasks/smart", json={"text": "dentista sexta 15h", "today": "2026-09-21"}, headers=usuaria["headers"])
    body = r.json()
    assert body["ai"] is True
    assert body["title"] == "Dentista"
    assert body["category"] == "saude"
    assert body["due_date"] == "2026-09-25"
    assert body["due_time"] == "15:00"
    assert body["subtasks"] == ["Confirmar horário"]
    assert body["is_recurring"] is False


def test_smart_recorrente_sem_ia_criterio_de_aceitacao(client, usuaria):
    """'Tomar vitamina todo dia às 08:00' -> is_recurring=True, daily (mesmo sem IA)."""
    r = client.post("/tasks/smart", json={"text": "Tomar vitamina todo dia às 08:00"}, headers=usuaria["headers"])
    body = r.json()
    assert body["is_recurring"] is True
    assert body["recurrence_pattern"] == "daily"


def test_smart_recorrente_com_ia(client, usuaria, gemini):
    gemini(title="Tomar vitamina", category="saude", due_date="2026-09-21", due_time="08:00",
           is_recurring=True, recurrence_pattern="daily", subtasks=[], suggestion=None)
    r = client.post("/tasks/smart", json={"text": "Tomar vitamina todo dia às 08:00", "today": "2026-09-21"},
                    headers=usuaria["headers"])
    body = r.json()
    assert body["ai"] is True
    assert body["is_recurring"] is True
    assert body["recurrence_pattern"] == "daily"
    assert body["due_time"] == "08:00"
    assert body["due_date"] == "2026-09-21"


def test_smart_rede_de_seguranca_quando_a_ia_esquece_a_recorrencia(client, usuaria, gemini):
    """O modelo não preencheu os campos: a detecção por regra completa."""
    gemini(title="Reunião de equipe", category="trabalho", due_date=None, due_time="10:00",
           subtasks=[], suggestion=None)
    # 2026-09-21 é segunda-feira; "toda quarta" -> primeira ocorrência: 2026-09-23.
    r = client.post("/tasks/smart", json={"text": "Reunião de equipe toda quarta às 10h", "today": "2026-09-21"},
                    headers=usuaria["headers"])
    body = r.json()
    assert body["recurrence_pattern"] == "weekly"
    assert body["is_recurring"] is True
    assert body["due_date"] == "2026-09-23"


def test_smart_todo_dia_10_e_mensal_e_acha_a_data(client, usuaria, gemini):
    gemini(title="Pagar aluguel", category="financas", due_date=None, due_time=None, subtasks=[], suggestion=None)
    r = client.post("/tasks/smart", json={"text": "Pagar aluguel todo dia 10", "today": "2026-09-21"},
                    headers=usuaria["headers"])
    body = r.json()
    assert body["recurrence_pattern"] == "monthly"
    assert body["due_date"] == "2026-10-10"  # dia 10 de setembro já passou


def test_smart_ignora_padrao_invalido_da_ia(client, usuaria, gemini):
    gemini(title="Ir ao mercado", category="casa", due_date=None, due_time=None,
           is_recurring=True, recurrence_pattern="yearly", subtasks=[], suggestion=None)
    body = client.post("/tasks/smart", json={"text": "ir ao mercado"}, headers=usuaria["headers"]).json()
    # "is_recurring: true" sem padrão válido não vale — não há ciclo a calcular.
    assert body["is_recurring"] is False and body["recurrence_pattern"] is None


def test_smart_texto_sem_repeticao_nao_e_recorrente(client, usuaria, gemini):
    gemini(title="Ligar pra vovó", category="relacionamento", due_date=None, due_time=None,
           subtasks=[], suggestion=None)
    body = client.post("/tasks/smart", json={"text": "ligar pra vovó amanhã"}, headers=usuaria["headers"]).json()
    assert body["is_recurring"] is False and body["recurrence_pattern"] is None


def test_smart_texto_vazio_da_422(client, usuaria):
    assert client.post("/tasks/smart", json={"text": ""}, headers=usuaria["headers"]).status_code == 422


# ----------------------- recorrência: persistência e validação -----------------------
def test_criar_tarefa_recorrente_persiste_os_campos(client, usuaria):
    t = _criar(client, usuaria["headers"], title="Tomar vitamina", due_date="2026-09-21", due_time="08:00",
               is_recurring=True, recurrence_pattern="daily")
    assert t["is_recurring"] is True and t["recurrence_pattern"] == "daily"
    lida = client.get("/tasks", headers=usuaria["headers"]).json()[0]
    assert lida["is_recurring"] is True and lida["recurrence_pattern"] == "daily"


def test_so_o_padrao_ja_liga_a_recorrencia(client, usuaria):
    t = _criar(client, usuaria["headers"], recurrence_pattern="weekly")
    assert t["is_recurring"] is True


def test_recorrente_sem_padrao_da_422(client, usuaria):
    r = client.post("/tasks", json={"title": "x", "is_recurring": True}, headers=usuaria["headers"])
    assert r.status_code == 422


def test_padrao_invalido_da_422(client, usuaria):
    r = client.post("/tasks", json={"title": "x", "is_recurring": True, "recurrence_pattern": "yearly"},
                    headers=usuaria["headers"])
    assert r.status_code == 422


def test_desligar_a_recorrencia_limpa_o_padrao(client, usuaria):
    t = _criar(client, usuaria["headers"], is_recurring=True, recurrence_pattern="daily")
    r = client.patch(f"/tasks/{t['id']}", json={"is_recurring": False}, headers=usuaria["headers"])
    assert r.json()["is_recurring"] is False and r.json()["recurrence_pattern"] is None


def test_trocar_o_padrao_de_uma_recorrente(client, usuaria):
    t = _criar(client, usuaria["headers"], is_recurring=True, recurrence_pattern="daily")
    r = client.patch(f"/tasks/{t['id']}", json={"recurrence_pattern": "monthly"}, headers=usuaria["headers"])
    assert r.json()["recurrence_pattern"] == "monthly" and r.json()["is_recurring"] is True


def test_ligar_recorrencia_numa_tarefa_comum_sem_padrao_nao_fica_incoerente(client, usuaria):
    t = _criar(client, usuaria["headers"])
    r = client.patch(f"/tasks/{t['id']}", json={"is_recurring": True}, headers=usuaria["headers"])
    assert r.status_code == 200
    assert r.json()["is_recurring"] is False and r.json()["recurrence_pattern"] is None


# ----------------------- recorrência: concluir -----------------------
def test_concluir_recorrente_rola_o_prazo_e_nao_fecha(client, usuaria):
    t = _criar(client, usuaria["headers"], title="Tomar vitamina", due_date="2026-09-21",
               is_recurring=True, recurrence_pattern="daily")
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-09-21", headers=usuaria["headers"]).json()
    assert r["done"] is False
    assert r["due_date"] == "2026-09-22"
    assert r["id"] == t["id"]
    # Nenhuma cópia foi criada.
    assert len(client.get("/tasks", headers=usuaria["headers"]).json()) == 1


def test_concluir_recorrente_semanal_e_mensal(client, usuaria):
    sem = _criar(client, usuaria["headers"], due_date="2026-09-21", is_recurring=True, recurrence_pattern="weekly")
    men = _criar(client, usuaria["headers"], due_date="2026-01-31", is_recurring=True, recurrence_pattern="monthly")
    assert client.put(f"/tasks/{sem['id']}/complete?today=2026-09-21", headers=usuaria["headers"]).json()["due_date"] == "2026-09-28"
    # 31/jan + 1 mês cai no último dia de fevereiro (today no passado do prazo → 1 ciclo).
    assert client.put(f"/tasks/{men['id']}/complete?today=2026-01-31", headers=usuaria["headers"]).json()["due_date"] == "2026-02-28"


def test_concluir_recorrente_atrasada_pula_os_ciclos_perdidos(client, usuaria):
    t = _criar(client, usuaria["headers"], due_date="2026-09-10", is_recurring=True, recurrence_pattern="weekly")
    # Prazo era uma quinta (10/09); hoje é 21/09 → próxima quinta depois de hoje: 24/09.
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-09-21", headers=usuaria["headers"]).json()
    assert r["due_date"] == "2026-09-24"


def test_concluir_recorrente_reseta_o_lembrete_push(client, usuaria):
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Task
    from datetime import datetime, timezone

    t = _criar(client, usuaria["headers"], due_date="2026-09-21", due_time="08:00",
               is_recurring=True, recurrence_pattern="daily")
    with SessionLocal() as db:
        row = db.scalar(select(Task).where(Task.id == t["id"]))
        row.reminder_sent_at = datetime.now(timezone.utc)
        db.commit()

    client.put(f"/tasks/{t['id']}/complete?today=2026-09-21", headers=usuaria["headers"])
    with SessionLocal() as db:
        assert db.scalar(select(Task).where(Task.id == t["id"])).reminder_sent_at is None


def test_concluir_tarefa_comum_continua_fechando(client, usuaria):
    t = _criar(client, usuaria["headers"], due_date="2026-09-21")
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-09-21", headers=usuaria["headers"]).json()
    assert r["done"] is True and r["due_date"] == "2026-09-21"


def test_concluir_recorrente_sem_prazo_conta_a_partir_de_hoje(client, usuaria):
    t = _criar(client, usuaria["headers"], is_recurring=True, recurrence_pattern="daily")
    r = client.put(f"/tasks/{t['id']}/complete?today=2026-09-21", headers=usuaria["headers"]).json()
    assert r["due_date"] == "2026-09-22"


def test_today_invalido_na_conclusao_da_422(client, usuaria):
    t = _criar(client, usuaria["headers"])
    assert client.put(f"/tasks/{t['id']}/complete?today=ontem", headers=usuaria["headers"]).status_code == 422
