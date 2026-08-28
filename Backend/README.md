# MenteLeve — Backend (API)

API REST em **FastAPI + PostgreSQL/Supabase (SQLAlchemy)**. Esta fase entrega o CRUD completo
de tarefas e o login simplificado. **A Inteligência Artificial ainda não está
plugada** — a rota `/tasks/smart` apenas persiste a tarefa e devolve o formato
que o frontend espera (com `subtasks` vazio e `suggestion` nulo).

## Stack
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + PostgreSQL (Supabase, via driver `psycopg`) — SQLite disponível como fallback local (padrão sem `DATABASE_URL`)
- Pydantic v2

## Como rodar (local)

```bash
cd Backend
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

A API sobe em `http://localhost:8000`. Documentação interativa: `http://localhost:8000/docs`.

## Estrutura

```
Backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, /health, monta routers
│   ├── config.py        # settings via variáveis de ambiente
│   ├── database.py      # engine SQLAlchemy (Postgres/SQLite), sessão, init_db()
│   ├── models.py        # User, Task
│   ├── schemas.py       # Pydantic (entrada/saída) + FREE_TASK_LIMIT
│   ├── crud.py          # operações de banco
│   ├── security.py      # hash de senha (bcrypt) + tokens JWT
│   ├── dependencies.py  # auth via Authorization: Bearer <token>
│   └── routers/
│       ├── auth.py      # /auth/login, /auth/me, /auth/me/premium
│       └── tasks.py     # CRUD de tarefas + /tasks/smart (stub sem IA)
├── requirements.txt
├── Procfile             # deploy (Render): uvicorn ...
├── .env.example
└── .gitignore
```

## Autenticação (JWT)

E-mail + senha, com hash **bcrypt** e token **JWT** (`HS256`). Fluxo:
1. `POST /auth/register` com `{ "email", "name", "password" }` → cria a conta e já
   devolve `{ access_token, token_type, user }`. Retorna **409** se o e-mail existir.
2. `POST /auth/login` com `{ "email", "password" }` → mesma resposta.
   Retorna **401** genérico ("E-mail ou senha incorretos") — não revela se o e-mail
   tem conta.
3. O frontend guarda o `access_token` e o envia como
   **`Authorization: Bearer <token>`** nas demais chamadas.

Requer a variável de ambiente **`SECRET_KEY`** (ver `.env.example`). Sem ela, o
backend usa uma chave aleatória por processo e derruba todas as sessões a cada
restart — no Render free isso acontece a cada cold start.

OAuth real (Google/Apple) ainda não está implementado — ver `docs/roadmap-sprints-menteleve.md`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Ping (usado pelo frontend) |
| POST | `/auth/register` | Cria conta (e-mail + senha) e devolve o token |
| POST | `/auth/login` | Autentica e devolve o token |
| GET | `/auth/me` | Dados do usuário atual |
| POST | `/auth/me/premium?is_premium=true` | Ativa/desativa Premium |
| GET | `/tasks` | Lista tarefas do usuário |
| POST | `/tasks` | Cria tarefa (campos completos) |
| POST | `/tasks/smart` | Analisa texto livre com a IA (título, `due_date`/`due_time`, subtarefas, sugestão) |
| PATCH | `/tasks/{id}` | Atualiza tarefa |
| PUT | `/tasks/{id}/complete` | Marca como concluída |
| PUT | `/tasks/{id}/uncomplete` | Reabre a tarefa |
| DELETE | `/tasks/{id}` | Exclui tarefa |
| POST | `/ai/chat` | Conversa com a Bruna; pode criar/concluir tarefas |

Todas as rotas de `/tasks` e `/auth/me*` exigem o header `Authorization: Bearer <token>`
(respondem **401** sem ele ou com token inválido/expirado).

## Bruna: ações pelo chat

`POST /ai/chat` usa *function calling* do Gemini. A Bruna pode chamar duas funções:
`criar_tarefa` e `concluir_tarefa`. **Excluir ficou de fora de propósito** — é
destrutivo e a identificação é por texto aproximado.

Pontos de projeto que importam ao mexer aqui (`routers/ai_chat.py`):
- **O modelo nunca informa um id.** Ele passa o título com as palavras da usuária e o
  servidor casa contra as tarefas **dela** (`_match_tasks`, ignorando acentos/caixa).
  Isso elimina a classe de erro "modelo inventa um id". Com mais de uma candidata,
  devolve `ambiguo` e a Bruna pergunta em vez de escolher.
- **Confirmação composta no servidor** no caminho feliz (1 ida ao modelo, mais rápido
  e sem risco de a IA narrar errado o que fez). A 2ª ida só acontece quando é preciso
  nuance: ambiguidade, tarefa não encontrada, limite do plano.
- **Idempotência:** o timeout do cliente não cancela a requisição, então a usuária
  podia ver o fallback, repetir o pedido e criar duplicata. `find_recent_duplicate`
  bloqueia isso.
- **Limite gratuito vira resultado de função**, não `HTTPException(402)` — um 402 aqui
  abortaria a resposta e a usuária perderia a fala da Bruna.

## IA: provedor principal e reserva

O plano gratuito do Gemini limita a **~20 requisições/minuto**. Ao estourar, ele devolve
**429** — e antes o app simplesmente caía no fallback ("estou com um probleminha para
pensar") sem nenhum rastro. Hoje o motivo aparece no log e existe **reserva automática**:

```
Gemini (GOOGLE_AI_API_KEY)
   └─ falhou/cota estourada/resposta vazia → Groq (GROQ_API_KEY)
        └─ também falhou → fallback gentil de texto
```

Vale para o chat da Bruna **e** para o `/tasks/smart`. A troca é transparente: os dois
provedores são normalizados para o mesmo formato interno de chamada de função
(`{name, args, id}`) em `ai.py`.

Detalhes que economizam depuração:
- O Groq usa o padrão **OpenAI** (`messages`, `tools[].function`, `tool_calls[]`), e o
  Gemini usa o seu próprio (`contents`, `function_declarations`, `functionCall`). Os
  adaptadores são `_gemini_chat` / `_groq_chat`.
- O Groq exige um **`User-Agent` explícito**: sem ele, o Cloudflare bloqueia o
  `Python-urllib/3.x` padrão com **HTTP 403 (erro 1010)** — que parece problema de
  chave, mas não é.
- Os **modelos disponíveis variam por conta**. Consulte
  `https://api.groq.com/openai/v1/models` com a sua chave antes de fixar `GROQ_MODEL`.

> ⚠️ O tier gratuito dos dois provedores permite uso do conteúdo para treinamento. Para
> um app de rotina/saúde feminina, considere o tier pago.

## Freemium
Usuários não-Premium têm limite de **50 tarefas** (`FREE_TASK_LIMIT`). Ao exceder,
a criação retorna **HTTP 402** (gatilho do Paywall no frontend).

## Deploy (Render)
- Build: `pip install -r requirements.txt`
- Start: definido no `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- **Importante:** aponte `DATABASE_URL` para o Postgres do Supabase — use a connection
  string do **"Session pooler"** (IPv4), não a "Direct connection" (IPv6-only, não
  resolve em muitos hosts/redes). Ver [`supabase_schema.sql`](supabase_schema.sql) para
  criar as tabelas e [`docs/Roadmap.md`](../docs/Roadmap.md) para o histórico completo.

## Próximo passo
Plugar a IA (Google AI Studio) na rota `/tasks/smart` — ver o `TODO(IA)` em
`app/routers/tasks.py`.
