# MenteLeve — Backend (API)

API REST em **FastAPI + PostgreSQL/Supabase (SQLAlchemy)**: CRUD de tarefas,
autenticação por e-mail + senha (JWT), IA (Gemini com reserva no Groq) e
criptografia do conteúdo em repouso.

## Stack
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + PostgreSQL (Supabase, via driver `psycopg`) — SQLite disponível como fallback local (padrão sem `DATABASE_URL`)
- Pydantic v2
- bcrypt (senhas) · PyJWT (tokens) · cryptography (AES-256-GCM do conteúdo)

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
│   ├── crypto.py        # AES-256-GCM do conteúdo em repouso (EncryptedText)
│   ├── ai.py            # Gemini + Groq (analyze, chat, function calling)
│   ├── dependencies.py  # auth via Authorization: Bearer <token>
│   └── routers/
│       ├── auth.py      # /auth/register, /auth/login, /auth/me, /auth/me/premium
│       ├── tasks.py     # CRUD de tarefas + /tasks/smart
│       └── ai_chat.py   # /ai/chat (Bruna) — cria e conclui tarefas
├── scripts/
│   └── encrypt_existing.py  # migra linhas anteriores à criptografia (uma vez)
├── supabase_schema.sql
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

> Não há limite de tentativas de login. O custo do bcrypt (~250 ms por tentativa)
> freia força bruta na prática, mas não é uma trava — está na lista de próximos passos.

## Criptografia do conteúdo (em repouso)

`tasks.title` e `users.name` são gravados com **AES-256-GCM** (`app/crypto.py`). Quem
obtiver um dump do Postgres, a `DATABASE_URL` ou o painel do Supabase vê `v1:<base64>`,
não o conteúdo. A chave (`ENCRYPTION_KEY`) vive só no ambiente do backend.

O uso é transparente: os models declaram o tipo `EncryptedText` (um `TypeDecorator`),
então `crud.py`, os routers, os schemas e a `ai.py` continuam vendo texto puro.

**O que NÃO é criptografado, e por quê:**

| Campo | Motivo |
|---|---|
| `users.email` | É a chave de busca do login (`WHERE email = ?`) e tem índice UNIQUE. Com nonce aleatório, o mesmo e-mail geraria valores diferentes e as duas coisas quebrariam |
| `due_date`, `category`, `done`, `important` | Sustentam o calendário e os índices (`ix_tasks_due_date`) |
| `tasks.due` | Rótulo de exibição ("Toda semana"), sem conteúdo pessoal |

Ou seja: o banco revela **quando**, não **o quê**.

**Armadilhas ao mexer aqui:**
- **Comparação em SQL não funciona** sobre coluna criptografada — `WHERE title = 'x'`,
  `LIKE` e `ORDER BY` alfabético nunca casam, porque comparam contra o ciphertext.
  Filtre em Python depois de carregar; ver `crud.find_recent_duplicate`, que já foi
  corrigido por causa disso (a falha seria **silenciosa**: voltaria a duplicar tarefa).
- **Nonce novo a cada gravação**, então o mesmo título gera valores diferentes — o banco
  não revela quais tarefas se repetem. Também é por isso que não dá para indexar.
- **Envelope versionado** (`v1:`): valor sem o prefixo é texto puro legado e passa
  direto. Foi o que permitiu ativar a criptografia sem migração obrigatória.
- **TEXT, não `VARCHAR(n)`**: o base64 infla ~37% (500 caracteres viram 687).
- Um valor adulterado no banco falha na autenticação do GCM em vez de devolver lixo.

**Sem `ENCRYPTION_KEY`** o app sobe, grava em texto puro e avisa no log. Deliberadamente
**não** existe fallback de chave aleatória como no `SECRET_KEY`: uma chave nova a cada
processo tornaria ilegível tudo que foi gravado antes do restart.

> ⚠️ **Perder a chave torna os dados já gravados irrecuperáveis.** Guarde uma cópia num
> gerenciador de senhas, fora do servidor. Trocar a chave depois só é possível com a
> antiga em mãos.

Para converter linhas anteriores à criptografia (idempotente, roda uma vez):
```bash
python scripts/encrypt_existing.py            # simulação
python scripts/encrypt_existing.py --aplicar  # grava
```

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
- **Variáveis obrigatórias:** `DATABASE_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`.
  As duas últimas são valores **diferentes**, geradas com
  `python -c "import secrets; print(secrets.token_hex(32))"`.

No boot, `init_db()` aplica micro-migrações: `_ensure_columns()` adiciona colunas novas
e `_widen_columns()` converte para `TEXT` as colunas criptografadas. As duas apenas
registram aviso se falharem — derrubar o boot deixaria a API inteira fora do ar.

## Próximos passos
- Limite de tentativas em `/auth/login`.
- `POST /auth/me/premium` permite que qualquer usuária autenticada se conceda Premium.
  Inofensivo enquanto o pagamento é simulado; **corrigir antes de haver cobrança real**.
- OAuth real (Google/Apple).
