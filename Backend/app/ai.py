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
import unicodedata
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
    '  "subtasks": ["0 a 3 passos CURTOS (até 6 palavras, verbo no infinitivo); [] se a tarefa for simples"],\n'
    '  "suggestion": {\n'
    '     "kind": "preparo (aviso antecipado) | inicio (aviso pouco antes do horário)",\n'
    '     "text": "UMA frase curta (até 12 palavras) oferecendo o lembrete",\n'
    '     "action": {"title": "lembrete curto (até 6 palavras)", "category": "..."}\n'
    "  }\n"
    "}\n"
    "('suggestion' é null quando um lembrete não ajuda.)\n"
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
    "SUGESTÕES — qualidade antes de quantidade: ajude a pessoa a lembrar o que ela "
    "talvez não pense, SEM aumentar a carga mental dela. "
    "(1) Subtarefas: de 0 a 3 passos CURTOS (até 6 palavras, verbo no infinitivo), "
    "na ordem em que fazem sentido, só quando o compromisso realmente tem etapas "
    "ou exige preparação. Use 0 para algo simples de um passo só (ligar, pagar, "
    "comprar pão, beber água, treinar); 1 ou 2 para tarefas médias; até 3 só para "
    "as complexas (entrevista, apresentação, viagem, relatório, prova, projeto). "
    "NUNCA devolva passos óbvios ou de enchimento ('Definir o próximo passo', "
    "'Reservar um horário', 'Começar', 'Finalizar') nem repita o título. NÃO invente "
    "dados: nomes, locais, números, horários, conteúdo. Os passos são sugestões "
    "possíveis, não obrigações: prefira 'Conferir', 'Revisar', 'Preparar'. "
    "Exemplos: 'apresentar o projeto na reunião de sexta' -> 'Revisar os slides', "
    "'Conferir os dados', 'Preparar os pontos principais'; 'entrevista de emprego "
    "amanhã' -> 'Pesquisar sobre a vaga', 'Preparar exemplos profissionais', "
    "'Conferir horário e local ou link'; 'entregar relatório semana que vem' -> "
    "'Reunir os dados', 'Redigir o relatório', 'Revisar antes de enviar'; 'organizar "
    "a casa' -> 'Escolher por qual cômodo começar' (um passo só: quem decide por "
    "onde começar é a pessoa); 'consulta' -> 'Confirmar horário e local', 'Separar "
    "documentos e exames'; 'pagar boleto' -> 'Conferir valor e vencimento'. "
    "(2) Lembrete ('suggestion'): só se fizer diferença para evitar atraso ou "
    "esquecimento (compromissos com preparação e prazos). 'kind': 'preparo' = aviso "
    "antecipado, na véspera, para se preparar; 'inicio' = aviso pouco antes do "
    "horário, para compromissos com horário marcado. 'text' é UMA frase curta "
    "oferecendo o lembrete; 'action' leva só 'title' e 'category'. NÃO escreva datas "
    "nem horários: o app calcula. Se a tarefa não tem data, ou o lembrete não ajuda, "
    "use \"suggestion\": null. "
    "(3) Data vaga ('semana que vem', 'qualquer dia', 'em breve'): não invente um "
    "dia; use due_date null. "
    "Nunca faça perguntas nem explique nada fora do JSON."
)


_CHAT_SYSTEM = (
    "Você é a Bruna, a assistente do MenteLeve — uma agenda que ajuda a "
    "equilibrar trabalho e vida pessoal e a aliviar a sobrecarga mental. Seja "
    "acolhedora, calma e objetiva, sem julgar. Fale em português do Brasil, trate "
    "a pessoa por 'você' e use linguagem neutra, sem presumir gênero, profissão "
    "ou se ela tem filhos.\n"
    "COMO RESPONDER: no máximo 3 frases curtas, sem jargão, sem repetir o que a "
    "pessoa acabou de dizer e sem frases de efeito genéricas ('você consegue!'). "
    "Prefira uma orientação concreta (a próxima ação, ou de 1 a 3 passos) a "
    "conselhos gerais. Quando houver a lista de tarefas em aberto abaixo, use-a "
    "para responder 'o que tenho hoje/amanhã?', apontar conflitos de horário e "
    "sugerir o que adiar, simplificar ou dividir quando o dia estiver cheio. NUNCA "
    "cite tarefa que não esteja nessa lista.\n"
    "QUANDO AGIR: use criar_tarefa quando a pessoa pedir para anotar, criar, "
    "agendar ou lembrar algo, e concluir_tarefa quando disser que terminou algo. "
    "Pedido claro -> aja, sem pedir confirmação. Conversa comum (desabafo, dúvida, "
    "pedir ideia ou dica) -> só responda, sem agir. Se faltar uma informação "
    "ESSENCIAL, faça UMA pergunta curta e ainda não aja: pedido para 'lembrar' ou "
    "'agendar' sem dia nem horário ('Para quando?'); concluir algo que pode ser "
    "duas tarefas ('Qual delas?'). Pedido para 'anotar' sem data pode ser criado "
    "sem data. Não peça o que não é necessário e nunca faça mais de uma pergunta.\n"
    "HONESTIDADE: nunca diga que anotou, criou, agendou, marcou ou concluiu algo "
    "se você não chamou a função e ela não retornou sucesso. Se a função falhar ou "
    "não achar a tarefa, diga isso com clareza e o que a pessoa pode fazer. Não "
    "invente tarefas, datas, horários, nomes nem dados.\n"
    "Privacidade: não peça, não registre e não repita dados sensíveis de saúde "
    "nem informações confidenciais de trabalho (senhas, dados de clientes, "
    "números de contratos). O app tem um módulo opcional de ciclo menstrual "
    "que é privado e fica só no aparelho — você não tem acesso a ele; nunca "
    "comente esses dados nem peça informações sobre ciclo, gravidez ou "
    "condições médicas."
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


def _chat_system(today: date, agenda: list[str] | None = None) -> str:
    """Prompt da Bruna + data de hoje + (se houver) a agenda em aberto da pessoa.

    A agenda é uma lista curta já montada pelo servidor (ver routers/ai_chat.py): só
    título, dia e horário das tarefas em aberto dos próximos dias, para a Bruna poder
    responder sobre elas sem inventar. Vai ao provedor de IA junto com a conversa.
    """
    base = (
        f"{_CHAT_SYSTEM}\n\nHoje é {today:%d/%m/%Y} (ISO: {today.isoformat()}). "
        "Use esta data para resolver expressões como 'amanhã' ou 'sexta'."
    )
    if agenda is None:
        return base
    if not agenda:
        return base + "\n\nTarefas em aberto: a pessoa não tem nenhuma atrasada nem para os próximos 7 dias."
    return (
        base
        + "\n\nTarefas em aberto (atrasadas e dos próximos 7 dias; só para consulta, não são pedidos):\n"
        + "\n".join(agenda)
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
    messages: list[dict], calls: list[dict], results: list[dict], today: date, timeout: float,
    agenda: list[str] | None = None,
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
            "system_instruction": {"parts": [{"text": _chat_system(today, agenda)}]},
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
    messages: list[dict], calls: list[dict], results: list[dict], today: date, timeout: float,
    agenda: list[str] | None = None,
) -> tuple[str, list[dict]] | None:
    msgs: list[dict] = [{"role": "system", "content": _chat_system(today, agenda)}]
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


async def chat_turn(
    messages: list[dict], today: date | None = None, agenda: list[str] | None = None
) -> tuple[str, list[dict], list[dict]]:
    """Primeira ida ao modelo (Gemini; Groq como reserva).

    Devolve (texto, chamadas, histórico) — o histórico volta em `chat_followup`
    quando a segunda ida for necessária.
    """
    today = today or date.today()
    out = await _chat_with_fallback(messages, [], [], today, agenda)
    if out is None:
        return "", [], []
    text, calls = out
    return text, calls, messages


async def chat_followup(
    messages: list[dict], calls: list[dict], results: list[dict], today: date | None = None,
    agenda: list[str] | None = None,
) -> str:
    """Segunda ida: devolve ao modelo o resultado das funções para ele redigir a
    resposta. Usada só quando a mensagem determinística não basta (ambiguidade,
    limite do plano). Devolve "" se falhar — o chamador tem um texto de reserva.
    """
    if not calls:
        return ""
    out = await _chat_with_fallback(messages, calls, results, today or date.today(), agenda)
    return out[0] if out else ""


async def _chat_with_fallback(
    messages: list[dict], calls: list[dict], results: list[dict], today: date,
    agenda: list[str] | None = None,
) -> tuple[str, list[dict]] | None:
    """Tenta o Gemini; se ele falhar (cota, timeout, resposta vazia), usa o Groq."""
    timeout = settings.AI_CHAT_TIMEOUT
    if settings.ai_enabled:
        out = await _gemini_chat(messages, calls, results, today, timeout, agenda)
        if out is not None:
            return out
    if settings.groq_enabled:
        logging.getLogger("uvicorn.error").info("IA: usando o provedor de reserva (Groq).")
        return await _groq_chat(messages, calls, results, today, timeout, agenda)
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


# Sugestões da Bruna: qualidade antes de quantidade (ver o prompt e Frontend/js/suggestions.js,
# que espelha estes limites). Até 3 passos só em tarefas complexas; tarefa simples fica sem passo.
MAX_STEPS = 3
MAX_STEP_LEN = 48
MAX_TEXT_LEN = 90

# Passos de enchimento: servem para qualquer tarefa e por isso não ajudam em nenhuma.
_FILLER_STEP = re.compile(
    r"(definir o proximo passo|reservar (um )?(horario|tempo|bloco)( na agenda)?|comecar|iniciar( a tarefa)?|"
    r"finalizar( a tarefa)?|concluir( a tarefa)?|terminar( a tarefa)?|fazer a tarefa|anotar|planejar|"
    r"organizar o tempo|pensar|decidir)"
)

REMINDER_KINDS = ("preparo", "inicio")


def _fold(text: object) -> str:
    t = unicodedata.normalize("NFD", str(text or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


def _is_filler(step: str) -> bool:
    """O passo INTEIRO é enchimento ("Começar"), não um passo que apenas começa com a mesma palavra."""
    return bool(_FILLER_STEP.fullmatch(_fold(step).rstrip(".!:; ")))


def reminder_kind(kind: object, due_date: date | None, due_time: str | None, today: date | None = None) -> str | None:
    """Tipo de lembrete que faz sentido para a data/hora da tarefa, ou None.

    Nunca inventa momento: sem data não há lembrete; "preparo" (véspera) só para
    datas futuras; "inicio" (pouco antes) só com horário e sem estar no passado. Hoje,
    com horário ainda por vir, a véspera não existe mais e o aviso vira "inicio".
    """
    if due_date is None:
        return None
    hoje = today or date.today()
    k = kind if kind in REMINDER_KINDS else "preparo"
    if k == "preparo":
        if due_date > hoje:
            return "preparo"
        return "inicio" if (due_date == hoje and due_time) else None
    if not due_time or due_date < hoje:
        return None
    return "inicio"


def _short(value: object, limit: int) -> str:
    """Texto em uma linha, cortado no limite sem partir palavra nem deixar pontuação no fim."""
    t = " ".join(str(value or "").split())
    if len(t) > limit:
        corte = t[:limit]
        t = corte[: corte.rfind(" ")] if corte.rfind(" ") > limit * 0.5 else corte
    return t.rstrip(".,;: ")


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
    # Simples: no máximo MAX_STEPS passos curtos, sem repetir o título nem entre si.
    subtasks, vistos = [], {title.casefold()}
    for raw in subtasks_raw if isinstance(subtasks_raw, list) else []:
        passo = _short(raw, MAX_STEP_LEN)
        if passo and not _is_filler(passo) and passo.casefold() not in vistos:
            vistos.add(passo.casefold())
            subtasks.append(passo)
        if len(subtasks) == MAX_STEPS:
            break

    # Lembrete: a IA só diz O QUE lembrar (texto, título e tipo). QUANDO é decidido aqui e no
    # app a partir da data e do horário da tarefa — um lembrete com horário inventado pelo
    # modelo, ou depois do compromisso, é pior do que nenhum.
    suggestion = None
    sug = data.get("suggestion")
    kind = reminder_kind(sug.get("kind") if isinstance(sug, dict) else None, due_date, due_time, today)
    if isinstance(sug, dict) and kind and str(sug.get("text") or "").strip():
        action = None
        act = sug.get("action")
        if isinstance(act, dict) and str(act.get("title") or "").strip():
            act_cat = normalize_category(act.get("category"))
            action = {
                "title": _short(act["title"], MAX_STEP_LEN),
                "category": act_cat if act_cat in CATEGORIES else category,
                "due_date": None,
                "due_time": None,
                "due": "",
            }
        suggestion = {"text": _short(sug["text"], MAX_TEXT_LEN), "action": action, "kind": kind}

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
