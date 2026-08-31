# 🧠 MenteLeve

> A sua mente não foi feita para guardar tudo.

**MenteLeve** é um aplicativo de gestão da **carga mental** — um "Segundo Cérebro" inteligente pensado especialmente para mulheres e mães. Ele organiza a rotina sem atrito, com **Inteligência Artificial** que antecipa os passos invisíveis do dia a dia (o *Aha Moment*).

🔗 **App (PWA):** https://mente-leve-teal.vercel.app
🔗 **API:** https://menteleve.onrender.com · [`/docs`](https://menteleve.onrender.com/docs)

---

## ✨ Funcionalidades

- **Criação inteligente de tarefas (IA):** escreva em linguagem natural e a IA normaliza o título, extrai **data e horário**, categoria, sugere subtarefas e um **lembrete preventivo**.
- **Subtarefas da IA fixadas** na tarefa-mãe (a sugestão vira filho da tarefa que você criou).
- **Bruna — chat com IA que age:** além de acolher e organizar, ela **cria e conclui tarefas pelo chat** ("cria uma consulta amanhã às 10h", "marca o mercado como feito").
- **Agenda em calendário mensal** navegável, com as tarefas distribuídas por data.
- **🌸 Calendário menstrual** (opcional e 100% privado/local): fases do ciclo, período fértil, ovulação e previsão da próxima menstruação.
- **Categorias, prioridade, data e horário** por tarefa; micro-interações de recompensa ao concluir.
- **Rede de apoio** (compartilhar a carga) e **Paywall Premium** (modelo freemium).
- **PWA instalável** e com suporte offline (Service Worker) — 264 KB de precache em
  disco, ~149 KB transferidos (o gzip do servidor comprime os textos; as imagens já
  chegam comprimidas).
- **Conteúdo criptografado no banco** (AES-256-GCM): o título das tarefas e o nome da usuária são ilegíveis para quem acessa o banco por fora da API.

---

## 🛠️ Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | HTML + CSS + **JavaScript Vanilla (ES Modules)** + **Tailwind (CDN)** · PWA (manifest + Service Worker) |
| **Backend** | **FastAPI** + **SQLAlchemy 2.0** + **PostgreSQL (Supabase)** · Pydantic v2 · Uvicorn |
| **IA** | **Google AI Studio / Gemini** (`gemini-2.5-flash`) via REST |
| **Deploy** | Frontend: **Vercel** · Backend: **Render** · Banco: **Supabase** |

Design System: **Bordeaux Pink** (regra 60:30:10) — fundo `#fff0f3`, estrutura `#590d22`, destaque `#ff4d6d`.

---

## 📁 Estrutura do projeto

```
MenteLeve/
├── Frontend/                 # PWA (publicado na Vercel)
│   ├── index.html            # shell + config do Tailwind
│   ├── manifest.json · sw.js # PWA (instalação + cache offline)
│   ├── css/styles.css        # Design System + layout responsivo + animações
│   ├── assets/               # ilustrações (WebP) + ícones do PWA (PNG)
│   └── js/
│       ├── app.js            # bootstrap + mini-router
│       ├── store.js          # estado local (localStorage) + sync
│       ├── api.js            # cliente REST (JWT) + heurística de fallback
│       ├── dates.js          # prazo estruturado (resolução + exibição)
│       ├── sound.js          # feedback sonoro sintetizado (Web Audio)
│       ├── ui.js             # helpers, ícones, navegação
│       ├── components/       # taskSheet (nova tarefa + Aha Moment)
│       └── views/            # onboarding, login, register, home, agenda, chat (Bruna), connections, paywall, profile
│
├── Backend/                  # API (publicada no Render)
│   ├── app/
│   │   ├── main.py           # app FastAPI, CORS, /health
│   │   ├── config.py         # settings via .env
│   │   ├── database.py       # engine SQLAlchemy (Postgres/Supabase) + micro-migrações
│   │   ├── security.py       # bcrypt (senhas) + JWT (tokens)
│   │   ├── crypto.py         # AES-256-GCM do conteúdo em repouso
│   │   ├── models.py · schemas.py · crud.py
│   │   ├── ai.py             # integração Gemini + Groq (analyze + chat)
│   │   └── routers/          # auth, tasks (+ /tasks/smart), ai_chat (Bruna)
│   ├── scripts/              # encrypt_existing.py (migração das linhas antigas)
│   ├── requirements.txt · Procfile · runtime.txt
│   └── .env.example
│
└── docs/                     # contexto, estilo, roteiro de telas
```

---

## 🚀 Como rodar localmente

### Pré-requisitos
- **Python 3.12** (recomendado; veja a nota sobre 3.14 abaixo)
- Um navegador moderno

### 1) Backend (API)
```bash
cd Backend
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt

# configure o ambiente
copy .env.example .env        # Windows  (ou: cp .env.example .env)
# edite o .env: coloque sua GOOGLE_AI_API_KEY e, se for usar Postgres/Supabase,
# a DATABASE_URL (connection string do "Session pooler" — ver seção do Supabase abaixo)

uvicorn app.main:app --reload
```
API em `http://localhost:8000` · docs em `http://localhost:8000/docs`.

### 2) Frontend (PWA)
ES Modules e Service Worker exigem HTTP (não abra via `file://`):
```bash
cd Frontend
python -m http.server 5500
```
Acesse `http://localhost:5500`. O `API_BASE` detecta automaticamente o ambiente (localhost em dev, Render em produção).

> 💡 **Nota Python 3.14:** as dependências estão fixadas em versões com *wheels* para cp314. Para produção/Render, o `runtime.txt` fixa Python 3.12.8.

---

## 🤖 Configuração da IA

Crie uma chave no **Google AI Studio**: https://aistudio.google.com/apikey e defina no `.env` do backend:

```env
GOOGLE_AI_API_KEY=sua_chave_aqui
AI_MODEL=gemini-2.5-flash     # opcional
AI_TIMEOUT=12                 # opcional (segundos)

# Reserva: usada quando o Gemini falha ou estoura a cota (429).
# Chave grátis, sem cartão: https://console.groq.com
GROQ_API_KEY=sua_chave_groq
```

> ⚠️ O plano gratuito do Gemini limita a **~20 requisições/minuto**. Ao estourar, a API
> devolve 429 — por isso existe a reserva no Groq. Sem nenhuma das duas, o app continua
> funcionando em **modo fallback** (normaliza o título, sem sugestões da IA).

Detalhes da troca entre provedores em [`Backend/README.md`](Backend/README.md).

---

## 🔌 Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Ping (status da API) |
| `POST` | `/auth/register` · `/auth/login` | Cadastro / login (e-mail + senha) — devolvem o token |
| `GET` | `/tasks` · `POST` `/tasks` | Listar / criar tarefa |
| `POST` | `/tasks/smart` | Analisa texto livre com IA (título, data, horário, subtarefas, sugestão) |
| `PUT` | `/tasks/{id}/complete` · `/uncomplete` | Concluir / reabrir |
| `DELETE` | `/tasks/{id}` | Excluir (remove subtarefas) |
| `POST` | `/ai/chat` | Conversa com a **Bruna** — pode criar/concluir tarefas (function calling) |

Autenticação: cadastro/login por e-mail + senha (hash **bcrypt**); o backend devolve um **token JWT** que o frontend envia no header **`Authorization: Bearer <token>`**. Limite freemium: 50 tarefas → `HTTP 402` (dispara o Paywall).

---

## 🔐 Segurança

| Camada | Como está |
|---|---|
| **Rotas** | Toda rota de dados exige JWT válido; além do login, há checagem de **posse** por tarefa (responde `404`, para não confirmar que a tarefa existe) |
| **Senhas** | **bcrypt** com salt por senha — hash de mão única, a senha nunca é gravada nem registrada em log |
| **Conteúdo no banco** | **AES-256-GCM** no título das tarefas e no nome da usuária (ver [`Backend/app/crypto.py`](Backend/app/crypto.py)). Um dump do Postgres não revela nada sem a `ENCRYPTION_KEY`, que vive só no ambiente do backend |
| **Em trânsito** | HTTPS ponta a ponta (Vercel e Render) |

**O que continua legível, de propósito:** e-mail (é a chave de busca do login, com índice UNIQUE), data, categoria e status — são eles que sustentam o calendário e os índices. Ou seja: o banco revela *quando*, não *o quê*.

**Limites conhecidos** — vale ter claro:
- A chave e o banco ficam ambos no Render. Comprometer essa conta entrega os dois.
- A **Bruna envia o texto das tarefas para o Google (Gemini) e o Groq**. Nenhuma criptografia no banco muda isso.
- **Não há limite de tentativas de login.** O custo do bcrypt (~250 ms) freia na prática, mas não é uma trava de verdade.
- **RLS do Supabase não é usada** — e não adiantaria: o backend conecta com a role `postgres`, que ignora RLS. O isolamento entre contas está na aplicação. RLS só faria sentido se o frontend falasse direto com o Supabase, o que não acontece.
- O `localStorage` do aparelho guarda as tarefas em texto puro (é o que faz o modo offline funcionar).

> ⚠️ **Perder a `ENCRYPTION_KEY` torna os dados já gravados irrecuperáveis.** Não existe recuperação. Guarde uma cópia num gerenciador de senhas, fora do servidor.

---

## ☁️ Deploy

### Banco → Supabase (Postgres)
- Schema pronto em [`Backend/supabase_schema.sql`](Backend/supabase_schema.sql) (cole no SQL Editor do projeto).
- Use a connection string do **"Session pooler"** (não a "Direct connection" — essa é IPv6-only e falha em redes/hosts IPv4, incluindo o Render). Painel do Supabase → **Connect** → **Connection string** → **Session pooler**.
- `DATABASE_URL` no formato `postgresql+psycopg://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres`.

### Backend → Render
- **Root Directory:** `Backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Variáveis:** `DATABASE_URL` (Supabase, ver acima), **`SECRET_KEY`** (obrigatória — sem
  ela o backend gera uma chave aleatória por processo e **desloga todo mundo a cada
  restart**), **`ENCRYPTION_KEY`** (criptografia do conteúdo — ver abaixo),
  `GOOGLE_AI_API_KEY`, `GROQ_API_KEY` (reserva da IA), `AI_MODEL`,
  `PYTHON_VERSION=3.12.8`, `CORS_ORIGINS=https://mente-leve-teal.vercel.app`

Gere `SECRET_KEY` e `ENCRYPTION_KEY` (valores **diferentes**) com:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> ⚠️ Guarde a `ENCRYPTION_KEY` num gerenciador de senhas **antes** de subir. Perdê-la
> torna as tarefas já gravadas irrecuperáveis — não há como reverter.

Para converter linhas gravadas antes da criptografia (roda uma vez, é idempotente):
```bash
cd Backend
python scripts/encrypt_existing.py            # simulação, não grava
python scripts/encrypt_existing.py --aplicar  # grava
```

> O plano free "dorme" após ~15 min de inatividade (cold start de ~30–50s). Mitigado com um ping externo gratuito (ex.: cron-job.org) batendo em `/health` a cada ~10 min.

### Frontend → Vercel
- **Root Directory:** `Frontend`
- **Framework Preset:** Other (sem build — HTML/JS puro).
- Deploy automático a cada push em `main` (via integração Vercel ↔ GitHub).

Detalhes completos da migração (SQLite→Postgres, GitHub Pages→Vercel) em [`docs/Roadmap.md`](docs/Roadmap.md).

---

## 🗺️ Roadmap

**Concluído:**
- Migração para Supabase + Vercel — [`docs/Roadmap.md`](docs/Roadmap.md)
- Sprint 1: autenticação real (JWT + senha com bcrypt)
- Sprint 2: prazo estruturado (data/horário) e a **Bruna executando ações** pelo chat
- Sprint 3: responsividade em tablet e imagens otimizadas (precache −90%)
- Sprint 4: feedback sonoro (com opção de silenciar) e correções no Service Worker
- Sprint 5: criptografia do conteúdo em repouso (AES-256-GCM)

📍 **[`docs/estado-atual.md`](docs/estado-atual.md)** — o que funciona hoje, o que é
fachada, decisões de arquitetura e pendências.
🗺️ **[`docs/historico-sprints.md`](docs/historico-sprints.md)** — resumo de todas as
sprints (MVP, migração e evolução).

Detalhamento completo de cada sprint em
[`docs/roadmap-sprints-menteleve.md`](docs/roadmap-sprints-menteleve.md).

**Próximos passos:**
- [ ] **Limite de tentativas de login** — hoje `/auth/login` aceita tentativas infinitas
- [ ] Sincronização offline → online das tarefas criadas localmente (não há fila de escrita)
- [ ] OAuth real (Apple / Google) e notificações da rede de apoio
- [ ] Recorrência de tarefas (precisa de coluna própria — ver Sprint 2)
- [ ] **Corrigir antes de haver cobrança real:** `POST /auth/me/premium` permite que
      qualquer usuária autenticada se conceda Premium

---

## 📄 Licença

Projeto em desenvolvimento. Uso e distribuição a definir pelo autor.

---

<p align="center">Feito com 💗 para deixar a sua mente mais leve.</p>
