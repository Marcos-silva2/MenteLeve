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
import logging
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
    "cansaço.\n"
    "Você pode AGIR no app: use a função criar_tarefa quando a usuária pedir "
    "para anotar/criar/lembrar algo, e concluir_tarefa quando ela disser que "
    "terminou algo. Só chame uma função quando o pedido for claro; em conversa "
    "comum (desabafo, dúvida, apoio), apenas responda com carinho, sem agir. "
    "Nunca invente que fez algo que não fez.\n"
    "Privacidade: não peça, não registre e não repita dados sensíveis de saúde. "
    "O app tem um calendário menstrual que é privado e fica só no aparelho da "
    "usuária — você não tem acesso a ele; nunca comente esses dados nem peça "
    "informações sobre ciclo, gravidez ou condições médicas. Não invente dados "
    "pessoais."
)

# Funções que a Bruna pode executar. Excluir tarefa ficou de fora de propósito:
# é destrutivo e a identificação é por texto aproximado.
_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "criar_tarefa",
                "description": (
                    "Cria uma nova tarefa para a usuária. Use quando ela pedir para "
                    "anotar, criar, agendar ou lembrar de algo."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título curto e claro, com inicial maiúscula.",
                        },
                        "categoria": {
                            "type": "string",
                            "enum": list(CATEGORIES),
                            "description": "Categoria mais provável da tarefa.",
                        },
                        "due_date": {
                            "type": "string",
                            "description": (
                                "Data no formato AAAA-MM-DD, resolvida a partir da data "
                                "de hoje informada. Omita se não houver data."
                            ),
                        },
                        "due_time": {
                            "type": "string",
                            "description": "Horário HH:MM em 24h. Omita se não houver.",
                        },
                    },
                    "required": ["titulo"],
                },
            },
            {
                "name": "concluir_tarefa",
                "description": (
                    "Marca uma tarefa existente como concluída. Use quando a usuária "
                    "disser que já fez/terminou algo."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": (
                                "Título (ou parte dele) da tarefa que a usuária disse "
                                "ter concluído, com as palavras dela."
                            ),
                        },
                    },
                    "required": ["titulo"],
                },
            },
        ]
    }
]


def _post(body: dict, timeout: float) -> dict | None:
    """POST ao Gemini. Devolve o payload ou None em qualquer falha.

    Registra o motivo no log: sem isso, uma cota estourada (429) fica
    indistinguível de "a IA não quis responder" — a usuária vê a mensagem de
    fallback e não há como diagnosticar. O plano gratuito do Gemini limita a
    ~20 requisições/minuto, o que é fácil de atingir com poucas usuárias.
    """
    url = _ENDPOINT.format(model=settings.AI_MODEL, key=settings.GOOGLE_AI_API_KEY)
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    log = logging.getLogger("uvicorn.error")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            log.warning("Gemini: cota excedida (429) — verifique o plano da GOOGLE_AI_API_KEY.")
        else:
            log.warning("Gemini: erro HTTP %s.", e.code)
        return None
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        log.warning("Gemini indisponível: %s", type(e).__name__)
        return None


def _read_parts(payload: dict | None) -> tuple[str, list[dict]]:
    """Extrai (texto, chamadas de função) da resposta.

    Percorre TODAS as partes: texto e `functionCall` coexistem, e o modelo pode
    emitir várias chamadas de uma vez. Tolera candidato sem `content`
    (finishReason MAX_TOKENS/SAFETY) e resposta sem candidato (prompt bloqueado).
    """
    if not payload:
        return "", []
    candidates = payload.get("candidates") or []
    if not candidates:
        return "", []
    parts = (candidates[0].get("content") or {}).get("parts") or []

    texts: list[str] = []
    calls: list[dict] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        if isinstance(part.get("text"), str) and part["text"].strip():
            texts.append(part["text"].strip())
        call = part.get("functionCall")
        if isinstance(call, dict) and call.get("name"):
            calls.append({"name": call["name"], "args": call.get("args") or {}})
    return "\n".join(texts).strip(), calls


def _to_contents(messages: list[dict]) -> list[dict]:
    """Histórico do app -> formato do Gemini (assistant vira "model")."""
    contents = []
    for m in messages[-20:]:
        role = "model" if m.get("role") == "assistant" else "user"
        text = str(m.get("content") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    return contents


def _chat_body(contents: list[dict], today: date) -> dict:
    system = (
        f"{_CHAT_SYSTEM}\n\nHoje é {today:%d/%m/%Y} (ISO: {today.isoformat()}). "
        "Use esta data para resolver expressões como 'amanhã' ou 'sexta'."
    )
    return {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
        "tools": _TOOLS,
        "generationConfig": {
            "temperature": 0.7,
            # Espaço maior que o do /tasks/smart: aqui há esquemas de ferramenta
            # e o "pensamento" fica ligado (desligá-lo piora bastante a decisão
            # de quando chamar uma função).
            "maxOutputTokens": 1200,
        },
    }


def chat_turn(messages: list[dict], today: date | None = None) -> tuple[str, list[dict], list[dict]]:
    """Primeira ida ao modelo.

    Devolve (texto, chamadas de função, contents) — `contents` é reaproveitado
    por `chat_followup` para a segunda ida, quando ela for necessária.
    """
    if not settings.ai_enabled:
        return "", [], []
    contents = _to_contents(messages)
    if not contents:
        return "", [], []

    today = today or date.today()
    payload = _post(_chat_body(contents, today), settings.AI_CHAT_TIMEOUT)
    text, calls = _read_parts(payload)
    return text, calls, contents


def chat_followup(
    contents: list[dict], calls: list[dict], results: list[dict], today: date | None = None
) -> str:
    """Segunda ida: devolve ao modelo o resultado das funções para ele redigir a
    resposta. Usada só quando a mensagem determinística não basta (ambiguidade,
    limite do plano). Devolve "" se falhar — o chamador tem um texto de reserva.
    """
    if not settings.ai_enabled or not calls:
        return ""

    convo = list(contents)
    convo.append({
        "role": "model",
        "parts": [{"functionCall": {"name": c["name"], "args": c["args"]}} for c in calls],
    })
    convo.append({
        "role": "user",
        "parts": [
            {"functionResponse": {"name": c["name"], "response": r}}
            for c, r in zip(calls, results)
        ],
    })

    payload = _post(_chat_body(convo, today or date.today()), settings.AI_CHAT_TIMEOUT)
    text, _ = _read_parts(payload)
    return text


def chat(messages: list[dict]) -> str | None:
    """Conversa simples (sem ações). Mantida para compatibilidade."""
    text, _, _ = chat_turn(messages)
    return text or None


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
