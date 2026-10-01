"""Integração com a IA (Google AI Studio / Gemini).

Responsável pelo "Aha Moment" do MenteLeve: a partir de um texto livre,
a IA normaliza a tarefa (NLP), extrai data/categoria, sugere subtarefas e
um lembrete preventivo (mapeamento de dependências) — conforme docs/IA.md.

Assíncrono (httpx.AsyncClient): as chamadas ao Gemini/Groq podem levar
segundos, e um servidor Uvicorn com um único worker (ver Procfile) roda rotas
`def` síncronas no threadpool compartilhado — uma IA lenta consumiria threads
que `/auth` e `/tasks` também precisam. Sendo `async`, a espera de rede libera
o event loop em vez de segurar uma thread.

Qualquer falha (sem chave, rede, parsing) retorna ``None`` para que a rota
caia em um fallback gracioso.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date

import httpx

from app import recurrence, timerange
from app.categories import CATEGORIES, DEFAULT_CATEGORY, normalize_category
from app.circuit import CircuitBreaker
from app.config import settings

_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)

_GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

# Abre depois de 3 falhas seguidas do Gemini (timeout, 429, erro de rede) e
# fica fechado por 30s — tempo de sobra para uma cota por minuto liberar uma
# fresta, sem fazer toda requisição nesse meio-tempo pagar o timeout inteiro
# só para falhar do mesmo jeito. Aplicado só ao Gemini: o Groq já É a reserva,
# não precisa de uma reserva da reserva.
_gemini_breaker = CircuitBreaker(fail_threshold=3, cooldown_seconds=30)

_SYSTEM = (
    "Você é a inteligência do MenteLeve, uma agenda para quem concilia trabalho "
    "e vida pessoal. A partir de um texto livre, você organiza a tarefa e "
    "ANTECIPA os passos invisíveis do compromisso (o 'Aha Moment'), seja uma "
    "reunião ou uma consulta. "
    "Responda SEMPRE em português do Brasil e SOMENTE com um objeto JSON "
    "válido, sem texto extra, no formato:\n"
    "{\n"
    '  "title": "título curto e claro, com inicial maiúscula",\n'
    '  "category": "uma de: ' + " | ".join(CATEGORIES) + '",\n'
    '  "due_date": "data ISO AAAA-MM-DD, ou null se não houver data",\n'
    '  "due_time": "horário HH:MM em 24h, ou null se não houver horário",\n'
    '  "end_time": "HH:MM de término só se o texto der a duração ou o fim (das 10h às 11h, reunião de 1h); senão null",\n'
    '  "is_recurring": "true se a tarefa se repete; false caso contrário",\n'
    '  "recurrence_pattern": "daily | weekly | monthly, ou null se não se repete",\n'
    '  "recurrence_weekdays": "só para weekly em dias específicos: lista com 0=segunda ... 6=domingo; senão null",\n'
    '  "recurrence_until": "AAAA-MM-DD do último dia da série, só se o texto disser até quando; senão null",\n'
    '  "subtasks": ["até 3 passos menores; [] se não fizer sentido"],\n'
    '  "suggestion": {\n'
    '     "text": "uma sugestão preventiva gentil (1 frase) ou null",\n'
    '     "action": {"title": "tarefa preventiva", "category": "...",\n'
    '                "due_date": "AAAA-MM-DD ou null", "due_time": "HH:MM ou null"}\n'
    "  }\n"
    "}\n"
    "Categorias — TRABALHO: trabalho (tarefas e entregas do dia a dia, relatórios, "
    "e-mails, projetos, clientes); reunioes (reuniões, calls, 1:1, alinhamentos, "
    "apresentações marcadas); carreira (currículo, LinkedIn, entrevistas, "
    "promoção, networking, metas profissionais); estudos (cursos, provas, "
    "faculdade, leitura, certificações, idiomas). VIDA: casa (compras, limpeza, "
    "consertos, rotina doméstica); familia (filhos, pais, parentes, escola dos "
    "filhos, eventos de família); saude (consultas, exames, remédios, treino, "
    "terapia); financas (contas, boletos, impostos, investimentos, orçamento); "
    "pessoal (lazer, amigos, parceiro(a), hobbies, viagens, autocuidado). "
    "Em caso de dúvida entre trabalho e vida, escolha pelo contexto do texto; "
    "sem pista nenhuma, use casa.\n"
    "Regras de data: SEMPRE resolva expressões relativas usando a data de hoje "
    "informada na mensagem (ex.: 'amanhã', 'sexta', 'dia 15' viram a data ISO "
    "correspondente). Nunca devolva texto em due_date — apenas AAAA-MM-DD ou null. "
    "Se a tarefa se repete (ex.: 'toda semana'), devolva a data da PRIMEIRA "
    "ocorrência. Se não houver data alguma, use null.\n"
    "Regras de recorrência: 'todo dia', 'todos os dias', 'diariamente' -> "
    "daily; 'toda semana', 'toda segunda-feira' (qualquer dia da semana) -> "
    "weekly; 'todo mês', 'todo dia 10' (um dia fixo do mês) -> monthly. Nesses "
    "casos use is_recurring=true e o padrão correspondente; a data é a da "
    "primeira ocorrência (ex.: 'toda segunda' -> a próxima segunda; 'todo dia' "
    "-> hoje; 'todo dia 10' -> o próximo dia 10). Se a tarefa não se repete, use "
    "is_recurring=false e recurrence_pattern=null. Nunca invente recorrência. "
    "Dias específicos: 'dias úteis' ou 'de segunda a sexta' -> weekly com "
    "recurrence_weekdays [0,1,2,3,4]; 'toda segunda e quarta' -> weekly com [0,2]; "
    "um dia só ('toda segunda') -> weekly com recurrence_weekdays null. Fim da série: "
    "'até 20/12' ou 'até dezembro' -> recurrence_until com a data ('até dezembro' = "
    "último dia do mês); sem fim dito, null. Exemplos de trabalho: 'reunião de "
    "equipe toda segunda às 9h' -> weekly, a próxima segunda, 09:00; 'relatório "
    "todo dia 5' -> monthly; 'daily às 9h nos dias úteis' -> weekly [0,1,2,3,4].\n"
    "Subtarefas e sugestão: gere subtarefas apenas quando houver dependências "
    "reais. Exemplos de trabalho: reunião com cliente -> preparar pauta, enviar "
    "o convite, registrar a ata depois; entrega de relatório/projeto -> revisar, "
    "pedir aprovação, enviar; apresentação -> montar os slides, ensaiar; "
    "entrevista -> pesquisar a empresa, revisar o currículo; prova -> separar "
    "o material, revisar. Exemplos de vida: viagem, consulta, festa, compras, "
    "conta a pagar. A 'suggestion' deve antecipar algo a preparar ANTES/DEPOIS "
    "do evento (ex.: reunião amanhã às 10h -> revisar a pauta na véspera; "
    "viagem no dia 12 -> comprar protetor solar no dia 10; relatório na sexta "
    "-> reservar um bloco para revisar na quinta). "
    "Se não houver sugestão útil, use \"suggestion\": null."
)


_CHAT_SYSTEM = (
    "Você é a Bruna, a assistente do MenteLeve — uma agenda que ajuda a "
    "equilibrar trabalho e vida pessoal e a aliviar a sobrecarga mental. Sua "
    "personalidade é acolhedora, calma, prática e objetiva, como uma colega "
    "de confiança que organiza as coisas com a pessoa. Fale sempre em "
    "português do Brasil, em tom gentil e próximo; trate a pessoa por "
    "'você' e use linguagem neutra, sem presumir gênero, profissão ou se ela "
    "tem filhos. Respostas curtas e diretas (no máximo ~4 frases), sem "
    "jargão. Ajude a priorizar e organizar a semana (reuniões, entregas, "
    "estudos, compromissos pessoais), sugira como dividir o dia em blocos, "
    "dê dicas para reduzir a sobrecarga e ofereça apoio emocional leve "
    "quando perceber cansaço ou estresse, sem tom clínico.\n"
    "Você pode AGIR no app: use a função criar_tarefa quando a pessoa pedir "
    "para anotar/criar/agendar/lembrar algo, e concluir_tarefa quando ela "
    "disser que terminou algo. Só chame uma função quando o pedido for claro; "
    "em conversa comum (desabafo, dúvida, apoio), apenas responda com "
    "cuidado, sem agir. Nunca invente que fez algo que não fez.\n"
    "Privacidade: não peça, não registre e não repita dados sensíveis de saúde "
    "nem informações confidenciais de trabalho (senhas, dados de clientes, "
    "números de contratos). O app tem um módulo opcional de ciclo menstrual "
    "que é privado e fica só no aparelho — você não tem acesso a ele; nunca "
    "comente esses dados nem peça informações sobre ciclo, gravidez ou "
    "condições médicas. Não invente dados pessoais."
)

# Funções que a Bruna pode executar. Excluir tarefa ficou de fora de propósito:
# é destrutivo e a identificação é por texto aproximado.
#
# Formato neutro: cada provedor embrulha isso do seu jeito (ver _gemini_tools /
# _groq_tools). O Gemini usa `function_declarations`; o Groq segue o padrão
# OpenAI (`{"type": "function", "function": ...}`).
_TOOL_SPECS = [
            {
                "name": "criar_tarefa",
                "description": (
                    "Cria uma nova tarefa para a pessoa. Use quando ela pedir para "
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
                        "hora_fim": {
                            "type": "string",
                            "description": "Horário de término HH:MM, só se a pessoa disse a duração ou até que horas. Omita se não houver.",
                        },
                        "dias_semana": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": (
                                "Só com recorrencia weekly em dias específicos: 0=segunda ... "
                                "6=domingo. Dias úteis = [0,1,2,3,4]. Omita para um dia só."
                            ),
                        },
                        "ate": {
                            "type": "string",
                            "description": "Último dia da série (AAAA-MM-DD), só se a pessoa disse até quando.",
                        },
                        "recorrencia": {
                            "type": "string",
                            "enum": list(recurrence.PATTERNS),
                            "description": (
                                "Só se a tarefa se repete: daily (todo dia), weekly "
                                "(toda semana / todo dia da semana) ou monthly (todo mês / "
                                "todo dia 10). Omita se não se repete."
                            ),
                        },
                    },
                    "required": ["titulo"],
                },
            },
            {
                "name": "concluir_tarefa",
                "description": (
                    "Marca uma tarefa existente como concluída. Use quando a pessoa "
                    "disser que já fez/terminou algo."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": (
                                "Título (ou parte dele) da tarefa que a pessoa disse "
                                "ter concluído, com as palavras dela."
                            ),
                        },
                    },
                    "required": ["titulo"],
                },
            },
]


def _gemini_tools() -> list[dict]:
    return [{"function_declarations": _TOOL_SPECS}]


def _groq_tools() -> list[dict]:
    return [{"type": "function", "function": spec} for spec in _TOOL_SPECS]


async def _post(body: dict, timeout: float) -> dict | None:
    """POST ao Gemini. Devolve o payload ou None em qualquer falha.

    Registra o motivo no log: sem isso, uma cota estourada (429) fica
    indistinguível de "a IA não quis responder" — a pessoa vê a mensagem de
    fallback e não há como diagnosticar. O plano gratuito do Gemini limita a
    ~20 requisições/minuto, o que é fácil de atingir com poucos usuários.

    Gated pelo circuit breaker: com ele aberto, nem tenta — vai direto para
    quem chamou tratar como falha (e cair no Groq).
    """
    log = logging.getLogger("uvicorn.error")
    if not _gemini_breaker.allow():
        log.info("IA: Gemini em cooldown (circuit breaker) — pulando para a reserva.")
        return None

    url = _ENDPOINT.format(model=settings.AI_MODEL, key=settings.GOOGLE_AI_API_KEY)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=body, headers={"Content-Type": "application/json"})
            resp.raise_for_status()
            _gemini_breaker.record(True)
            return resp.json()
    except httpx.HTTPStatusError as e:
        _gemini_breaker.record(False)
        if e.response.status_code == 429:
            log.warning("Gemini: cota excedida (429) — verifique o plano da GOOGLE_AI_API_KEY.")
        else:
            log.warning("Gemini: erro HTTP %s.", e.response.status_code)
        return None
    except (httpx.HTTPError, ValueError, OSError) as e:
        _gemini_breaker.record(False)
        log.warning("Gemini indisponível: %s", type(e).__name__)
        return None


async def _post_groq(body: dict, timeout: float) -> dict | None:
    """POST ao Groq (API compatível com OpenAI). Mesmo contrato de _post.

    Sem circuit breaker: já é a reserva do Gemini, não precisa de uma reserva
    da reserva. Uma falha aqui já cai no fallback de texto do chamador.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        # Sem User-Agent explícito o Cloudflare do Groq bloqueia o
        # cliente HTTP padrão com HTTP 403 (erro 1010).
        "User-Agent": "MenteLeve/1.0",
    }
    log = logging.getLogger("uvicorn.error")
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_GROQ_ENDPOINT, json=body, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            log.warning("Groq: cota excedida (429).")
        else:
            log.warning("Groq: erro HTTP %s.", e.response.status_code)
        return None
    except (httpx.HTTPError, ValueError, OSError) as e:
        log.warning("Groq indisponível: %s", type(e).__name__)
        return None


def _read_groq(payload: dict | None) -> tuple[str, list[dict]]:
    """Extrai (texto, chamadas) da resposta do Groq, normalizando para o mesmo
    formato do Gemini: [{name, args, id}]."""
    if not payload:
        return "", []
    choices = payload.get("choices") or []
    if not choices:
        return "", []
    msg = choices[0].get("message") or {}

    text = str(msg.get("content") or "").strip()
    calls: list[dict] = []
    for tc in msg.get("tool_calls") or []:
        fn = (tc or {}).get("function") or {}
        name = fn.get("name")
        if not name:
            continue
        # `arguments` vem como string JSON (ao contrário do Gemini, que já manda objeto).
        raw = fn.get("arguments")
        if isinstance(raw, str):
            try:
                args = json.loads(raw)
            except ValueError:
                args = {}
        else:
            args = raw or {}
        calls.append({"name": name, "args": args, "id": tc.get("id")})
    return text, calls


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
            # `id` só existe no Groq; mantido no formato para uniformizar.
            calls.append({"name": call["name"], "args": call.get("args") or {}, "id": None})
    return "\n".join(texts).strip(), calls


def _chat_system(today: date) -> str:
    return (
        f"{_CHAT_SYSTEM}\n\nHoje é {today:%d/%m/%Y} (ISO: {today.isoformat()}). "
        "Use esta data para resolver expressões como 'amanhã' ou 'sexta'."
    )


# ------------------------------------------------------------------
# Provedores
#
# As funções abaixo recebem o histórico no formato interno do app
# ([{role: user|assistant, content}]) e devolvem (texto, chamadas) — ou None
# quando o provedor não respondeu nada aproveitável, o que dispara a reserva.
#
# `calls` é normalizado como [{name, args, id}]. O `id` só existe no Groq
# (padrão OpenAI exige devolvê-lo no turno seguinte); no Gemini fica None.
# ------------------------------------------------------------------
async def _gemini_chat(
    messages: list[dict], calls: list[dict], results: list[dict], today: date, timeout: float
) -> tuple[str, list[dict]] | None:
    contents = []
    for m in messages[-20:]:
        text = str(m.get("content") or "").strip()
        if text:
            role = "model" if m.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": text}]})
    if not contents:
        return None

    if calls:
        contents.append({
            "role": "model",
            "parts": [{"functionCall": {"name": c["name"], "args": c["args"]}} for c in calls],
        })
        contents.append({
            "role": "user",
            "parts": [
                {"functionResponse": {"name": c["name"], "response": r}}
                for c, r in zip(calls, results)
            ],
        })

    payload = await _post(
        {
            "system_instruction": {"parts": [{"text": _chat_system(today)}]},
            "contents": contents,
            "tools": _gemini_tools(),
            # Espaço maior que o do /tasks/smart: aqui há esquemas de ferramenta
            # e o "pensamento" fica ligado (desligá-lo piora bastante a decisão
            # de quando chamar uma função).
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1200},
        },
        timeout,
    )
    text, parsed = _read_parts(payload)
    return (text, parsed) if (text or parsed) else None


async def _groq_chat(
    messages: list[dict], calls: list[dict], results: list[dict], today: date, timeout: float
) -> tuple[str, list[dict]] | None:
    msgs: list[dict] = [{"role": "system", "content": _chat_system(today)}]
    for m in messages[-20:]:
        text = str(m.get("content") or "").strip()
        if text:
            role = "assistant" if m.get("role") == "assistant" else "user"
            msgs.append({"role": role, "content": text})
    if len(msgs) == 1:
        return None

    if calls:
        msgs.append({
            "role": "assistant",
            "tool_calls": [
                {
                    "id": c.get("id") or f"call_{i}",
                    "type": "function",
                    "function": {"name": c["name"], "arguments": json.dumps(c["args"])},
                }
                for i, c in enumerate(calls)
            ],
        })
        for i, (c, r) in enumerate(zip(calls, results)):
            msgs.append({
                "role": "tool",
                "tool_call_id": c.get("id") or f"call_{i}",
                "content": json.dumps(r, ensure_ascii=False),
            })

    payload = await _post_groq(
        {
            "model": settings.GROQ_MODEL,
            "messages": msgs,
            "tools": _groq_tools(),
            "temperature": 0.7,
            "max_tokens": 1200,
        },
        timeout,
    )
    text, parsed = _read_groq(payload)
    return (text, parsed) if (text or parsed) else None


async def chat_turn(messages: list[dict], today: date | None = None) -> tuple[str, list[dict], list[dict]]:
    """Primeira ida ao modelo (Gemini; Groq como reserva).

    Devolve (texto, chamadas, histórico) — o histórico volta em `chat_followup`
    quando a segunda ida for necessária.
    """
    today = today or date.today()
    out = await _chat_with_fallback(messages, [], [], today)
    if out is None:
        return "", [], []
    text, calls = out
    return text, calls, messages


async def chat_followup(
    messages: list[dict], calls: list[dict], results: list[dict], today: date | None = None
) -> str:
    """Segunda ida: devolve ao modelo o resultado das funções para ele redigir a
    resposta. Usada só quando a mensagem determinística não basta (ambiguidade,
    limite do plano). Devolve "" se falhar — o chamador tem um texto de reserva.
    """
    if not calls:
        return ""
    out = await _chat_with_fallback(messages, calls, results, today or date.today())
    return out[0] if out else ""


async def _chat_with_fallback(
    messages: list[dict], calls: list[dict], results: list[dict], today: date
) -> tuple[str, list[dict]] | None:
    """Tenta o Gemini; se ele falhar (cota, timeout, resposta vazia), usa o Groq."""
    timeout = settings.AI_CHAT_TIMEOUT
    if settings.ai_enabled:
        out = await _gemini_chat(messages, calls, results, today, timeout)
        if out is not None:
            return out
    if settings.groq_enabled:
        logging.getLogger("uvicorn.error").info("IA: usando o provedor de reserva (Groq).")
        return await _groq_chat(messages, calls, results, today, timeout)
    return None


async def chat(messages: list[dict]) -> str | None:
    """Conversa simples (sem ações). Mantida para compatibilidade."""
    text, _, _ = await chat_turn(messages)
    return text or None


async def analyze(text: str, today: date | None = None) -> dict | None:
    """Analisa o texto livre e devolve a estrutura do 'Aha Moment'.

    `today` é a data local do usuário (o servidor roda em UTC). Sem ela,
    datas relativas como "amanhã" erram um dia à noite no Brasil.

    Retorna ``None`` quando a IA não está configurada ou em caso de erro,
    sinalizando à rota que deve usar o fallback.
    """
    today = today or date.today()
    prompt = (
        f"Hoje é {today:%d/%m/%Y} (ISO: {today.isoformat()}).\n"
        f"Texto do usuário: {text.strip()}"
    )

    raw = None
    if settings.ai_enabled:
        payload = await _post(
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
            },
            settings.AI_TIMEOUT,
        )
        raw, _ = _read_parts(payload)

    if not raw and settings.groq_enabled:
        logging.getLogger("uvicorn.error").info("IA: usando o provedor de reserva (Groq).")
        payload = await _post_groq(
            {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.4,
                "max_tokens": 800,
            },
            settings.AI_TIMEOUT,
        )
        raw, _ = _read_groq(payload)

    if not raw:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None

    return _sanitize(data, fallback_title=text, today=today)


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


def _sanitize(data: dict, fallback_title: str, today: date | None = None) -> dict:
    """Valida/limpa a saída do modelo para o formato esperado pelo app.

    `fallback_title` é o texto original do usuário: além de servir de título
    quando o modelo não dá um, é onde a recorrência é procurada por regra quando o
    modelo esquece de preenchê-la (ver recurrence.detect_recurrence).
    """
    title = str(data.get("title") or fallback_title).strip()[:500]
    if title:
        title = title[0].upper() + title[1:]

    category = normalize_category(data.get("category"))
    if category not in CATEGORIES:
        category = DEFAULT_CATEGORY

    due_date = _clean_date(data.get("due_date"))
    due_time = _clean_time(data.get("due_time"))
    end_time = timerange.clean_end_time(due_time, _clean_time(data.get("end_time"))) \
        or timerange.detect_end_time(fallback_title, due_time)

    # O padrão manda; a flag `is_recurring` é derivada dele. Um "is_recurring:
    # true" sem padrão válido não tem como ser usado (não há ciclo a calcular).
    # Sem data dita, a primeira ocorrência é deduzida do texto ("toda segunda",
    # "todo dia 10", "dias úteis") e, sem pista, começa hoje.
    rec = recurrence.resolve(
        fallback_title, today or date.today(),
        pattern=data.get("recurrence_pattern"),
        weekdays=data.get("recurrence_weekdays"),
        until=_clean_date(data.get("recurrence_until")),
        due_date=due_date,
    )
    due_date = rec["due_date"]

    subtasks_raw = data.get("subtasks") or []
    subtasks = [str(s).strip()[:200] for s in subtasks_raw if str(s).strip()][:3]

    suggestion = None
    sug = data.get("suggestion")
    if isinstance(sug, dict) and str(sug.get("text") or "").strip():
        action = None
        act = sug.get("action")
        if isinstance(act, dict) and str(act.get("title") or "").strip():
            act_cat = normalize_category(act.get("category"))
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
        "end_time": end_time,
        # O rótulo livre deixa de ser produzido pela IA: o frontend deriva o
        # texto amigável a partir de due_date/due_time (ver formatDue).
        "due": "",
        "is_recurring": rec["is_recurring"],
        "recurrence_pattern": rec["recurrence_pattern"],
        "recurrence_weekdays": rec["recurrence_weekdays"],
        "recurrence_until": rec["recurrence_until"],
        "subtasks": subtasks,
        "suggestion": suggestion,
    }
