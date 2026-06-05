"""Integração com a IA (Google AI Studio / Gemini).

Responsável pelo "Aha Moment" do MenteLeve: a partir de um texto livre,
a IA normaliza a tarefa (NLP), extrai data/categoria, sugere subtarefas e
um lembrete preventivo (mapeamento de dependências) — conforme docs/IA.md.

Usa apenas a biblioteca padrão (urllib) para evitar dependências extras e
problemas de wheels no Python 3.14. Qualquer falha (sem chave, rede, parsing)
retorna ``None`` para que a rota caia em um fallback gracioso.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import date

from app.config import settings

# Categorias válidas (espelham o design system / schemas).
CATEGORIES = ("casa", "filhos", "trabalho", "saude", "financas", "relacionamento")

_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)

_SYSTEM = (
    "Você é a inteligência do MenteLeve, um app que reduz a carga mental de "
    "mães e mulheres. A partir de um texto livre, você organiza a tarefa e "
    "ANTECIPA os passos invisíveis da rotina (o 'Aha Moment'). "
    "Responda SEMPRE em português do Brasil e SOMENTE com um objeto JSON "
    "válido, sem texto extra, no formato:\n"
    "{\n"
    '  "title": "título curto e claro, com inicial maiúscula",\n'
    '  "category": "uma de: casa | filhos | trabalho | saude | financas | relacionamento",\n'
    '  "due": "quando, curto (ex: Hoje, Amanhã, 15/06, Toda semana) ou string vazia",\n'
    '  "subtasks": ["até 3 passos menores; [] se não fizer sentido"],\n'
    '  "suggestion": {\n'
    '     "text": "uma sugestão preventiva gentil (1 frase) ou null",\n'
    '     "action": {"title": "tarefa preventiva", "category": "...", "due": "..."}\n'
    "  }\n"
    "}\n"
    "Regras: escolha a categoria mais provável; gere subtarefas apenas quando "
    "houver dependências reais (festa, viagem, consulta, compras, conta a pagar, "
    "reunião); a 'suggestion' deve antecipar algo a preparar ANTES/DEPOIS do "
    "evento (ex: 'Viagem dia 12' -> 'Comprar protetor solar dia 10'). "
    "Se não houver sugestão útil, use \"suggestion\": null."
)


def analyze(text: str) -> dict | None:
    """Analisa o texto livre e devolve a estrutura do 'Aha Moment'.

    Retorna ``None`` quando a IA não está configurada ou em caso de erro,
    sinalizando à rota que deve usar o fallback.
    """
    if not settings.ai_enabled:
        return None

    prompt = f"Hoje é {date.today():%d/%m/%Y}.\nTexto da usuária: {text.strip()}"
    body = json.dumps(
        {
            "system_instruction": {"parts": [{"text": _SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.4,
                "maxOutputTokens": 800,
                # Desliga o "thinking" do Gemini 2.5 (sem ele, os tokens iam
                # para o raciocínio e truncavam o JSON — finishReason MAX_TOKENS).
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
    ).encode("utf-8")

    url = _ENDPOINT.format(model=settings.AI_MODEL, key=settings.GOOGLE_AI_API_KEY)
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=settings.AI_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        raw = payload["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(raw)
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError):
        return None

    return _sanitize(data, fallback_title=text)


def _sanitize(data: dict, fallback_title: str) -> dict:
    """Valida/limpa a saída do modelo para o formato esperado pelo app."""
    title = str(data.get("title") or fallback_title).strip()[:500]
    if title:
        title = title[0].upper() + title[1:]

    category = data.get("category")
    if category not in CATEGORIES:
        category = "casa"

    due = str(data.get("due") or "").strip()[:120]

    subtasks_raw = data.get("subtasks") or []
    subtasks = [str(s).strip()[:200] for s in subtasks_raw if str(s).strip()][:3]

    suggestion = None
    sug = data.get("suggestion")
    if isinstance(sug, dict) and str(sug.get("text") or "").strip():
        action = None
        act = sug.get("action")
        if isinstance(act, dict) and str(act.get("title") or "").strip():
            act_cat = act.get("category")
            action = {
                "title": str(act["title"]).strip()[:500],
                "category": act_cat if act_cat in CATEGORIES else category,
                "due": str(act.get("due") or "").strip()[:120],
            }
        suggestion = {"text": str(sug["text"]).strip()[:300], "action": action}

    return {
        "title": title,
        "category": category,
        "due": due,
        "subtasks": subtasks,
        "suggestion": suggestion,
    }
