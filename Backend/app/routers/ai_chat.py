"""Rota de conversa com a Bruna (IA), com execução de ações nas tarefas."""
from __future__ import annotations

import unicodedata
from datetime import date
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import ai, crud, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Task, User
from app.schemas import FREE_TASK_LIMIT

router = APIRouter(prefix="/ai", tags=["ai"])

_FALLBACK = (
    "Estou com um probleminha para pensar agora 😅. Tenta de novo daqui a "
    "pouco? Enquanto isso, toque no + para registrar o que está na sua mente."
)

# Abaixo disso, dois títulos não são considerados a mesma tarefa.
_MATCH_THRESHOLD = 0.6


def _norm(text: str) -> str:
    """Minúsculas e sem acentos — 'Vacina do Léo' casa com 'vacina do leo'."""
    text = unicodedata.normalize("NFD", str(text or "").strip().lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _match_tasks(titulo: str, tasks: list[Task]) -> list[Task]:
    """Casa o título dito no chat com as tarefas em aberto.

    O casamento é feito aqui, e não pelo modelo: pedir um id ao modelo abriria
    espaço para ele inventar um. Ordem: exato → contido → similaridade.
    """
    alvo = _norm(titulo)
    if not alvo:
        return []

    exatos = [t for t in tasks if _norm(t.title) == alvo]
    if exatos:
        return exatos

    contidos = [t for t in tasks if alvo in _norm(t.title) or _norm(t.title) in alvo]
    if contidos:
        return contidos

    parecidos = [
        (SequenceMatcher(None, alvo, _norm(t.title)).ratio(), t) for t in tasks
    ]
    parecidos = [(r, t) for r, t in parecidos if r >= _MATCH_THRESHOLD]
    parecidos.sort(key=lambda p: p[0], reverse=True)
    return [t for _, t in parecidos[:3]]


def _criar_tarefa(args: dict, user: User, db: Session, today: date) -> tuple[dict, Task | None]:
    """Executa criar_tarefa. Devolve (resultado para o modelo, tarefa criada)."""
    titulo = str(args.get("titulo") or "").strip()[:500]
    if not titulo:
        return {"status": "erro", "motivo": "titulo vazio"}, None

    # Limite do plano gratuito: vira resultado de função, e não exceção — um 402
    # aqui abortaria a resposta inteira e a usuária perderia a fala da Bruna.
    if not user.is_premium and crud.count_tasks(db, user.id) >= FREE_TASK_LIMIT:
        return {
            "status": "limite_atingido",
            "limite": FREE_TASK_LIMIT,
            "instrucao": "Avise com gentileza que o limite gratuito acabou e sugira o Premium.",
        }, None

    categoria = args.get("categoria")
    if categoria not in ai.CATEGORIES:
        categoria = "casa"
    due_date = ai._clean_date(args.get("due_date"))
    due_time = ai._clean_time(args.get("due_time"))

    # Idempotência: a usuária pode reenviar o pedido quando a resposta demora
    # (o timeout do cliente não cancela a requisição já em andamento).
    existente = crud.find_recent_duplicate(db, user.id, titulo, due_date)
    if existente is not None:
        return {"status": "ja_existia", "titulo": existente.title}, existente

    task = crud.create_task(
        db,
        user.id,
        schemas.TaskCreate(
            title=titulo, category=categoria, due_date=due_date, due_time=due_time
        ),
    )
    return {"status": "criada", "titulo": task.title}, task


def _concluir_tarefa(args: dict, user: User, db: Session) -> tuple[dict, Task | None]:
    """Executa concluir_tarefa. Pede desempate quando há mais de uma candidata."""
    titulo = str(args.get("titulo") or "").strip()
    abertas = crud.list_open_tasks(db, user.id)
    candidatas = _match_tasks(titulo, abertas)

    if not candidatas:
        return {
            "status": "nao_encontrada",
            "instrucao": "Diga que não encontrou essa tarefa em aberto e peça o nome dela.",
        }, None
    if len(candidatas) > 1:
        return {
            "status": "ambiguo",
            "candidatos": [t.title for t in candidatas],
            "instrucao": "Pergunte qual dessas ela quer concluir. NÃO escolha sozinha.",
        }, None

    task = crud.set_task_done(db, candidatas[0], True)
    return {"status": "concluida", "titulo": task.title}, task


def _mensagem_pronta(results: list[dict]) -> str | None:
    """Confirmação composta no servidor para o caminho feliz.

    Evita uma segunda ida ao modelo (mais lento, e ele poderia narrar errado o
    que aconteceu). Devolve None quando é preciso o modelo redigir — ambiguidade,
    limite atingido, tarefa não encontrada.
    """
    criadas = [r["titulo"] for r in results if r.get("status") in ("criada", "ja_existia")]
    concluidas = [r["titulo"] for r in results if r.get("status") == "concluida"]
    if not criadas and not concluidas:
        return None
    if any(r.get("status") in ("ambiguo", "limite_atingido", "nao_encontrada") for r in results):
        return None

    partes = []
    if criadas:
        lista = ", ".join(f"“{t}”" for t in criadas)
        partes.append(f"Pronto, anotei {lista} pra você 💗")
    if concluidas:
        lista = ", ".join(f"“{t}”" for t in concluidas)
        partes.append(f"Marquei {lista} como concluída ✨ Boa!")
    return " ".join(partes)


@router.post("/chat", response_model=schemas.ChatOut)
def chat(
    data: schemas.ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Conversa com a Bruna — e executa ações quando ela decide usar uma função.

    Sem `GOOGLE_AI_API_KEY` (ou em falha da IA), devolve uma mensagem de
    fallback gentil para a conversa não quebrar.
    """
    history = [{"role": m.role, "content": m.content} for m in data.messages]
    today = data.today or date.today()

    text, calls, contents = ai.chat_turn(history, today=today)

    if not calls:
        return schemas.ChatOut(reply=text or _FALLBACK)

    # Executa as funções pedidas (o modelo pode pedir mais de uma).
    results: list[dict] = []
    afetadas: list[Task] = []
    for call in calls:
        if call["name"] == "criar_tarefa":
            result, task = _criar_tarefa(call["args"], user, db, today)
        elif call["name"] == "concluir_tarefa":
            result, task = _concluir_tarefa(call["args"], user, db)
        else:
            result, task = {"status": "erro", "motivo": "função desconhecida"}, None
        results.append(result)
        if task is not None:
            afetadas.append(task)

    reply = _mensagem_pronta(results)
    if reply is None:
        # Caminho que precisa de nuance (desempate, limite): deixa o modelo redigir.
        reply = ai.chat_followup(contents, calls, results, today=today) or text or _FALLBACK

    return schemas.ChatOut(
        reply=reply,
        tasks=[schemas.TaskOut.model_validate(t) for t in afetadas],
        limite_atingido=any(r.get("status") == "limite_atingido" for r in results),
    )
