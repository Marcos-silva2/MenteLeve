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
import re
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
    '  "due_date": "data ISO AAAA-MM-DD, ou null se não houver data",\n'
    '  "due_time": "horário HH:MM em 24h, ou null se não houver horário",\n'
    '  "subtasks": ["até 3 passos menores; [] se não fizer sentido"],\n'
    '  "suggestion": {\n'
    '     "text": "uma sugestão preventiva gentil (1 frase) ou null",\n'
    '     "action": {"title": "tarefa preventiva", "category": "...",\n'
    '                "due_date": "AAAA-MM-DD ou null", "due_time": "HH:MM ou null"}\n'
    "  }\n"
    "}\n"
    "Regras de data: SEMPRE resolva expressões relativas usando a data de hoje "
    "informada na mensagem (ex.: 'amanhã', 'sexta', 'dia 15' viram a data ISO "
    "correspondente). Nunca devolva texto em due_date — apenas AAAA-MM-DD ou null. "
    "Se a tarefa se repete (ex.: 'toda semana'), devolva a data da PRIMEIRA "
    "ocorrência. Se não houver data alguma, use null.\n"
    "Demais regras: escolha a categoria mais provável; gere subtarefas apenas "
    "quando houver dependências reais (festa, viagem, consulta, compras, conta a "
    "pagar, reunião); a 'suggestion' deve antecipar algo a preparar ANTES/DEPOIS "
    "do evento (ex.: viagem no dia 12 -> comprar protetor solar no dia 10). "
    "Se não houver sugestão útil, use \"suggestion\": null."
)


_CHAT_SYSTEM = (
    "Você é a Bruna, a assistente do MenteLeve — um app que ajuda mães e "
    "mulheres a aliviar a carga mental. Sua personalidade é acolhedora, "
    "empática, calma e prática, como uma amiga que organiza as coisas com "
    "você. Fale sempre em português do Brasil, em tom gentil e próximo. "
    "Respostas curtas e diretas (no máximo ~4 frases), sem jargão. "
    "Ajude a organizar a rotina, sugira como dividir tarefas, dê dicas para "
    "reduzir a sobrecarga e ofereça apoio emocional leve quando perceber "
    "cansaço. Quando fizer sentido, sugira que a usuária registre a tarefa no "
    "app (ela pode tocar no + para adicionar). Não invente dados pessoais."
)


def chat(messages: list[dict]) -> str | None:
    """Conversa da Bruna. Recebe o histórico [{role, content}] e devolve a
    resposta (texto) ou ``None`` em caso de falha/sem chave.
    """
    if not settings.ai_enabled:
        return None

    # Gemini usa role "user"/"model"; mapeamos "assistant" -> "model".
    contents = []
    for m in messages[-20:]:
        role = "model" if m.get("role") == "assistant" else "user"
        text = str(m.get("content") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    if not contents:
        return None

    body = json.dumps(
        {
            "system_instruction": {"parts": [{"text": _CHAT_SYSTEM}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 600,
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
        reply = payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError):
        return None
    return reply or None


def analyze(text: str, today: date | None = None) -> dict | None:
    """Analisa o texto livre e devolve a estrutura do 'Aha Moment'.

    `today` é a data local da usuária (o servidor roda em UTC). Sem ela,
    datas relativas como "amanhã" erram um dia à noite no Brasil.

    Retorna ``None`` quando a IA não está configurada ou em caso de erro,
    sinalizando à rota que deve usar o fallback.
    """
    if not settings.ai_enabled:
        return None

    today = today or date.today()
    prompt = (
        f"Hoje é {today:%d/%m/%Y} (ISO: {today.isoformat()}).\n"
        f"Texto da usuária: {text.strip()}"
    )
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


_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _clean_date(value: object) -> date | None:
    """Aceita apenas AAAA-MM-DD; qualquer outra coisa vira None."""
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _clean_time(value: object) -> str | None:
    """Aceita apenas HH:MM (24h); qualquer outra coisa vira None."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value if _TIME_RE.match(value) else None


def _sanitize(data: dict, fallback_title: str) -> dict:
    """Valida/limpa a saída do modelo para o formato esperado pelo app."""
    title = str(data.get("title") or fallback_title).strip()[:500]
    if title:
        title = title[0].upper() + title[1:]

    category = data.get("category")
    if category not in CATEGORIES:
        category = "casa"

    due_date = _clean_date(data.get("due_date"))
    due_time = _clean_time(data.get("due_time"))

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
                "due_date": _clean_date(act.get("due_date")),
                "due_time": _clean_time(act.get("due_time")),
                "due": "",
            }
        suggestion = {"text": str(sug["text"]).strip()[:300], "action": action}

    return {
        "title": title,
        "category": category,
        "due_date": due_date,
        "due_time": due_time,
        # O rótulo livre deixa de ser produzido pela IA: o frontend deriva o
        # texto amigável a partir de due_date/due_time (ver formatDue).
        "due": "",
        "subtasks": subtasks,
        "suggestion": suggestion,
    }
