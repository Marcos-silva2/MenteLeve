"""Espaços compartilhados: convite por código, acesso às tarefas e quem pode apagar."""
from __future__ import annotations

import pytest

from app import crud, spaces
from app.database import SessionLocal
from app.models import Space, SpaceMember

from conftest import auth_headers, registrar


def _pessoa(client, nome):
    d = registrar(client, email=f"{nome.lower()}@example.com", name=nome)
    return {"h": auth_headers(d["access_token"]), "id": d["user"]["id"], "nome": nome}


@pytest.fixture()
def trio(client):
    return _pessoa(client, "Ana"), _pessoa(client, "Bia"), _pessoa(client, "Caio")


def _espaco(client, dono, nome="Equipe"):
    r = client.post("/spaces", json={"name": nome}, headers=dono["h"])
    assert r.status_code == 201, r.text
    return r.json()


def _entrar(client, pessoa, espaco):
    r = client.post("/spaces/join", json={"code": espaco["invite_code"]}, headers=pessoa["h"])
    assert r.status_code == 200, r.text
    return r.json()


def _tarefa(client, pessoa, **campos):
    r = client.post("/tasks", json={"title": "Relatório", **campos}, headers=pessoa["h"])
    assert r.status_code == 201, r.text
    return r.json()


# ----------------------- código -----------------------
def test_codigo_tem_formato_e_normalizacao():
    c = spaces.new_invite_code()
    assert len(c) == 8 and all(ch not in "01OIL" for ch in c)
    assert spaces.normalize_code(" abcd-efgh ") == "ABCDEFGH" == spaces.normalize_code("abcd efgh")
    assert spaces.format_code("ABCDEFGH") == "ABCD-EFGH"


# ----------------------- criar / entrar / listar -----------------------
def test_criar_espaco_o_criador_e_dono_e_membro(client, trio):
    ana, *_ = trio
    e = _espaco(client, ana)
    assert e["name"] == "Equipe" and e["owner_id"] == ana["id"]
    assert [m["name"] for m in e["members"]] == ["Ana"] and e["members"][0]["is_owner"] is True
    assert len(e["invite_code"].replace("-", "")) == 8
    assert client.get("/spaces", headers=ana["h"]).json()[0]["id"] == e["id"]


def test_entrar_por_codigo_com_variacoes_e_idempotente(client, trio):
    ana, bia, _ = trio
    e = _espaco(client, ana)
    r = client.post("/spaces/join", json={"code": e["invite_code"].lower().replace("-", " ")}, headers=bia["h"])
    assert r.status_code == 200 and [m["name"] for m in r.json()["members"]] == ["Ana", "Bia"]
    again = client.post("/spaces/join", json={"code": e["invite_code"]}, headers=bia["h"])
    assert again.status_code == 200 and len(again.json()["members"]) == 2   # sem duplicar


def test_codigo_invalido_da_404_e_e_limitado(client, trio):
    _, bia, _ = trio
    for _i in range(10):
        assert client.post("/spaces/join", json={"code": "ZZZZ-ZZZZ"}, headers=bia["h"]).status_code == 404
    r = client.post("/spaces/join", json={"code": "ZZZZ-ZZZZ"}, headers=bia["h"])
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_so_o_proprio_usuario_e_penalizado_pelo_limite_por_usuario(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    for _i in range(10):
        client.post("/spaces/join", json={"code": "ZZZZ-ZZZZ"}, headers=bia["h"])
    # Bia travada, mas o limite por IP ainda não estourou: Caio entra normalmente.
    assert client.post("/spaces/join", json={"code": e["invite_code"]}, headers=caio["h"]).status_code == 200


def test_espacos_exigem_login(client):
    assert client.get("/spaces").status_code == 401
    assert client.post("/spaces", json={"name": "x"}).status_code == 401


def test_nome_vazio_e_recusado(client, trio):
    assert client.post("/spaces", json={"name": "   "}, headers=trio[0]["h"]).status_code == 422


def test_limites(client, trio, monkeypatch):
    ana, bia, caio = trio
    monkeypatch.setattr(spaces, "MAX_SPACES_PER_USER", 2)
    _espaco(client, ana, "A"); _espaco(client, ana, "B")
    assert client.post("/spaces", json={"name": "C"}, headers=ana["h"]).status_code == 409
    monkeypatch.setattr(spaces, "MAX_MEMBERS_PER_SPACE", 2)
    cheio = client.post("/spaces", json={"name": "Cheio"}, headers=bia["h"]).json()
    _entrar(client, _pessoa(client, "Duda"), cheio)   # Bia + Duda = 2 membros = limite
    assert client.post("/spaces/join", json={"code": cheio["invite_code"]}, headers=caio["h"]).status_code == 409


# ----------------------- acesso às tarefas -----------------------
def test_tarefa_do_espaco_aparece_para_todos_os_membros_e_so_para_eles(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    t = _tarefa(client, ana, title="Pauta da reunião", space_id=e["id"])
    assert t["space_id"] == e["id"] and t["author_name"] == "Ana"
    assert [x["id"] for x in client.get("/tasks", headers=bia["h"]).json()] == [t["id"]]
    assert client.get("/tasks", headers=caio["h"]).json() == []            # fora do espaço: nada
    assert client.patch(f"/tasks/{t['id']}", json={"title": "x"}, headers=caio["h"]).status_code == 404
    assert client.put(f"/tasks/{t['id']}/complete", headers=caio["h"]).status_code == 404
    assert client.delete(f"/tasks/{t['id']}", headers=caio["h"]).status_code == 404


def test_tarefa_pessoal_continua_privada_mesmo_com_espaco(client, trio):
    ana, bia, _ = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    t = _tarefa(client, ana, title="Segredo")
    assert t["space_id"] is None and t["author_name"] is None
    assert client.get("/tasks", headers=bia["h"]).json() == []
    assert client.patch(f"/tasks/{t['id']}", json={"title": "x"}, headers=bia["h"]).status_code == 404


def test_nao_membro_nao_cria_tarefa_no_espaco(client, trio):
    ana, _, caio = trio
    e = _espaco(client, ana)
    assert client.post("/tasks", json={"title": "x", "space_id": e["id"]}, headers=caio["h"]).status_code == 404
    assert client.post("/tasks", json={"title": "x", "space_id": 9999}, headers=caio["h"]).status_code == 404


def test_membro_edita_e_conclui_a_tarefa_de_outro(client, trio):
    ana, bia, _ = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    t = _tarefa(client, ana, space_id=e["id"])
    r = client.patch(f"/tasks/{t['id']}", json={"title": "Revisado pela Bia"}, headers=bia["h"])
    assert r.status_code == 200 and r.json()["title"] == "Revisado pela Bia" and r.json()["author_name"] == "Ana"
    assert client.put(f"/tasks/{t['id']}/complete", headers=bia["h"]).json()["done"] is True
    assert client.put(f"/tasks/{t['id']}/uncomplete", headers=ana["h"]).json()["done"] is False


def test_quem_pode_apagar(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e); _entrar(client, caio, e)
    da_bia = _tarefa(client, bia, title="Da Bia", space_id=e["id"])
    da_ana = _tarefa(client, ana, title="Da Ana", space_id=e["id"])
    # Caio não criou nem é dono
    assert client.delete(f"/tasks/{da_bia['id']}", headers=caio["h"]).status_code == 403
    # Bia não é dona e não criou a da Ana
    assert client.delete(f"/tasks/{da_ana['id']}", headers=bia["h"]).status_code == 403
    # o dono apaga a de qualquer um; o criador apaga a própria
    assert client.delete(f"/tasks/{da_bia['id']}", headers=ana["h"]).status_code == 204
    outra = _tarefa(client, bia, title="Outra", space_id=e["id"])
    assert client.delete(f"/tasks/{outra['id']}", headers=bia["h"]).status_code == 204


def test_subtarefa_herda_o_espaco_da_mae_e_nao_vaza(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    mae = _tarefa(client, ana, title="Festa", space_id=e["id"])
    filha = _tarefa(client, bia, title="Bolo", parent_id=mae["id"])           # sem enviar space_id
    assert filha["space_id"] == e["id"]
    assert {x["id"] for x in client.get("/tasks", headers=ana["h"]).json()} == {mae["id"], filha["id"]}
    # quem não enxerga a mãe não cria filha nela
    assert client.post("/tasks", json={"title": "x", "parent_id": mae["id"]}, headers=caio["h"]).status_code == 404
    # mãe pessoal + space_id enviado: a subtarefa fica pessoal (herda da mãe)
    pessoal = _tarefa(client, bia, title="Minha")
    f2 = _tarefa(client, bia, title="Passo", parent_id=pessoal["id"], space_id=e["id"])
    assert f2["space_id"] is None


def test_titulo_do_espaco_e_das_tarefas_continuam_criptografados(client, trio):
    ana, *_ = trio
    e = _espaco(client, ana, "Confidencial")
    _tarefa(client, ana, title="Fusão em segredo", space_id=e["id"])
    from sqlalchemy import text
    with SessionLocal() as db:
        nome = db.execute(text("select name from spaces")).scalar()
        titulo = db.execute(text("select title from tasks")).scalar()
    assert "Confidencial" not in nome and "Fusão" not in titulo


# ----------------------- sair, dono, convite -----------------------
def test_sair_perde_acesso_as_tarefas_do_espaco(client, trio):
    ana, bia, _ = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    t = _tarefa(client, bia, title="Da Bia", space_id=e["id"])
    assert client.post(f"/spaces/{e['id']}/leave", headers=bia["h"]).status_code == 204
    assert client.get("/spaces", headers=bia["h"]).json() == []
    assert client.get("/tasks", headers=bia["h"]).json() == []                   # nem a que ela mesma criou
    assert client.patch(f"/tasks/{t['id']}", json={"title": "x"}, headers=bia["h"]).status_code == 404
    assert [x["id"] for x in client.get("/tasks", headers=ana["h"]).json()] == [t["id"]]   # a equipe fica com ela


def test_dono_sai_e_o_mais_antigo_assume(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e); _entrar(client, caio, e)
    assert client.post(f"/spaces/{e['id']}/leave", headers=ana["h"]).status_code == 204
    novo = client.get("/spaces", headers=bia["h"]).json()[0]
    assert novo["owner_id"] == bia["id"] and [m["name"] for m in novo["members"]] == ["Bia", "Caio"]


def test_ultimo_a_sair_apaga_o_espaco_e_as_tarefas(client, trio):
    ana, *_ = trio
    e = _espaco(client, ana)
    _tarefa(client, ana, title="Some junto", space_id=e["id"])
    _tarefa(client, ana, title="Pessoal fica")
    assert client.post(f"/spaces/{e['id']}/leave", headers=ana["h"]).status_code == 204
    with SessionLocal() as db:
        assert db.query(Space).count() == 0 and db.query(SpaceMember).count() == 0
    titulos = [t["title"] for t in client.get("/tasks", headers=ana["h"]).json()]
    assert titulos == ["Pessoal fica"]


def test_resetar_convite_so_o_dono_e_invalida_o_antigo(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    assert client.post(f"/spaces/{e['id']}/invite/reset", headers=bia["h"]).status_code == 403
    novo = client.post(f"/spaces/{e['id']}/invite/reset", headers=ana["h"]).json()
    assert novo["invite_code"] != e["invite_code"]
    assert client.post("/spaces/join", json={"code": e["invite_code"]}, headers=caio["h"]).status_code == 404
    assert client.post("/spaces/join", json={"code": novo["invite_code"]}, headers=caio["h"]).status_code == 200
    assert client.post(f"/spaces/{e['id']}/invite/reset", headers=caio["h"]).status_code == 403


def test_dono_remove_membro(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    assert client.delete(f"/spaces/{e['id']}/members/{ana['id']}", headers=bia["h"]).status_code == 403   # só o dono
    assert client.delete(f"/spaces/{e['id']}/members/{ana['id']}", headers=ana["h"]).status_code == 400   # a si: sair
    assert client.delete(f"/spaces/{e['id']}/members/{caio['id']}", headers=ana["h"]).status_code == 404  # não está lá
    assert client.delete(f"/spaces/{e['id']}/members/{bia['id']}", headers=ana["h"]).status_code == 204
    assert client.get("/spaces", headers=bia["h"]).json() == []


def test_espaco_de_outra_pessoa_e_404_nao_403(client, trio):
    ana, _, caio = trio
    e = _espaco(client, ana)
    for rota in (f"/spaces/{e['id']}/leave", f"/spaces/{e['id']}/invite/reset"):
        assert client.post(rota, headers=caio["h"]).status_code == 404
    assert client.delete(f"/spaces/{e['id']}/members/{ana['id']}", headers=caio["h"]).status_code == 404


# ----------------------- lembretes e Bruna -----------------------
def test_lembrete_push_vai_para_todos_os_membros(client, trio):
    ana, bia, caio = trio
    e = _espaco(client, ana)
    _entrar(client, bia, e)
    t = _tarefa(client, ana, space_id=e["id"], due_date="2026-10-05", due_time="10:00")
    solo = _tarefa(client, caio, due_date="2026-10-05", due_time="10:00")
    with SessionLocal() as db:
        compartilhada = crud.get_task(db, t["id"])
        pessoal = crud.get_task(db, solo["id"])
        assert sorted(crud.reminder_recipients(db, compartilhada)) == sorted([ana["id"], bia["id"]])
        assert crud.reminder_recipients(db, pessoal) == [caio["id"]]
