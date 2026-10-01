"""Duração da tarefa (end_time): detecção no texto, validação e API."""
from __future__ import annotations

from datetime import date

import pytest

from app import ai
from app.timerange import clean_end_time, detect_end_time


@pytest.mark.parametrize("texto,inicio,fim", [
    ("reunião das 10h às 11h30", "10:00", "11:30"),
    ("das 9 às 18", "09:00", "18:00"),
    ("call de 14h às 15h", "14:00", "15:00"),
    ("call de 1h", "14:00", "15:00"),
    ("treino por 45 min", "07:00", "07:45"),
    ("aula de 1h30", "19:00", "20:30"),
    ("apresentação de 2 horas", "16:00", "18:00"),
])
def test_detecta_fim(texto, inicio, fim):
    assert detect_end_time(texto, inicio) == fim


@pytest.mark.parametrize("texto,inicio", [
    ("consulta 15h", "15:00"),
    ("reunião de equipe", "09:00"),
    ("viagem de 15 a 20 de outubro", "10:00"),   # datas, não horas
    ("das 23h às 1h", "23:00"),                   # passaria da meia-noite
    ("call de 1h", None),                         # sem início não há fim
])
def test_nao_inventa_fim(texto, inicio):
    assert detect_end_time(texto, inicio) is None


def test_clean_end_time():
    assert clean_end_time("10:00", "11:00") == "11:00"
    assert clean_end_time("10:00", "10:00") is None
    assert clean_end_time("10:00", "09:00") is None
    assert clean_end_time(None, "11:00") is None


def test_sanitize_usa_o_da_ia_ou_detecta():
    hoje = date(2026, 10, 1)
    r = ai._sanitize({"title": "Call", "due_time": "14:00", "end_time": "15:30"}, "call", hoje)
    assert r["end_time"] == "15:30"
    r = ai._sanitize({"title": "Call", "due_time": "14:00", "end_time": "13:00"}, "call de 1h", hoje)
    assert r["end_time"] == "15:00"   # o da IA era inválido; vale a detecção


def _criar(client, headers, **campos):
    return client.post("/tasks", json={"title": "Reunião", **campos}, headers=headers)


def test_api_persiste_e_lista(client, usuaria):
    r = _criar(client, usuaria["headers"], due_date="2026-10-01", due_time="10:00", end_time="11:00")
    assert r.status_code == 201 and r.json()["end_time"] == "11:00"
    assert client.get("/tasks", headers=usuaria["headers"]).json()[0]["end_time"] == "11:00"


@pytest.mark.parametrize("campos", [
    {"end_time": "11:00"},                                 # sem início
    {"due_time": "10:00", "end_time": "09:00"},            # antes do início
    {"due_time": "10:00", "end_time": "25:00"},
])
def test_api_recusa_fim_invalido(client, usuaria, campos):
    assert _criar(client, usuaria["headers"], **campos).status_code == 422


def test_api_tirar_ou_mover_o_inicio_limpa_o_fim_que_ficou_invalido(client, usuaria):
    h = usuaria["headers"]
    t = _criar(client, h, due_date="2026-10-01", due_time="10:00", end_time="11:00").json()
    r = client.patch(f"/tasks/{t['id']}", json={"due_time": "10:30"}, headers=h).json()
    assert r["end_time"] == "11:00"   # ainda válido
    r = client.patch(f"/tasks/{t['id']}", json={"due_time": "12:00"}, headers=h).json()
    assert r["end_time"] is None
    r = client.patch(f"/tasks/{t['id']}", json={"end_time": "13:00"}, headers=h).json()
    assert r["end_time"] == "13:00"
    r = client.patch(f"/tasks/{t['id']}", json={"due_time": None}, headers=h).json()
    assert r["end_time"] is None
