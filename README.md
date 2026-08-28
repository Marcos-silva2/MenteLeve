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
- **Categorias, prioridade e data** por tarefa; micro-interações de recompensa ao concluir.
- **Rede de apoio** (compartilhar a carga) e **Paywall Premium** (modelo freemium).
- **PWA instalável** e com suporte offline (Service Worker).

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
│   ├── css/styles.css        # Design System + animações
│   ├── assets/               # ícones, ilustrações
│   └── js/
│       ├── app.js            # bootstrap + mini-router
│       ├── store.js          # estado local (localStorage) + sync
│       ├── api.js            # cliente REST + IA + heurística de fallback
│       ├── ui.js             # helpers, ícones, navegação
│       ├── components/       # taskSheet (nova tarefa + Aha Moment)
│       └── views/            # onboarding, login, home, agenda, chat (Bruna), connections, paywall, profile
│
├── Backend/                  # API (publicada no Render)
│   ├── app/
│   │   ├── main.py           # app FastAPI, CORS, /health
│   │   ├── config.py         # settings via .env
│   │   ├── database.py       # engine SQLAlchemy (Postgres/Supabase) + micro-migrações
│   │   ├── models.py · schemas.py · crud.py
│   │   ├── ai.py             # integração Gemini (analyze + chat)
│   │   └── routers/          # auth, tasks (+ /tasks/smart), ai_chat (Bruna)
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
```

Sem a chave, o app continua funcionando em **modo fallback** (apenas normaliza o título, sem sugestões da IA).

---

## 🔌 Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Ping (status da API) |
| `POST` | `/auth/login` | Login/registro por e-mail (retorna `id`) |
| `GET` | `/tasks` · `POST` `/tasks` | Listar / criar tarefa |
| `POST` | `/tasks/smart` | Analisa texto livre com IA (título, data, subtarefas, sugestão) |
| `PUT` | `/tasks/{id}/complete` · `/uncomplete` | Concluir / reabrir |
| `DELETE` | `/tasks/{id}` | Excluir (remove subtarefas) |
| `POST` | `/ai/chat` | Conversa com a **Bruna** — pode criar/concluir tarefas (function calling) |

Autenticação: cadastro/login por e-mail + senha (hash **bcrypt**); o backend devolve um **token JWT** que o frontend envia no header **`Authorization: Bearer <token>`**. Limite freemium: 50 tarefas → `HTTP 402` (dispara o Paywall).

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
- **Variáveis:** `GOOGLE_AI_API_KEY`, `AI_MODEL`, `PYTHON_VERSION=3.12.8`, `DATABASE_URL` (Supabase, ver acima), `CORS_ORIGINS=https://mente-leve-teal.vercel.app`

> O plano free "dorme" após ~15 min de inatividade (cold start de ~30–50s). Mitigado com um ping externo gratuito (ex.: cron-job.org) batendo em `/health` a cada ~10 min.

### Frontend → Vercel
- **Root Directory:** `Frontend`
- **Framework Preset:** Other (sem build — HTML/JS puro).
- Deploy automático a cada push em `main` (via integração Vercel ↔ GitHub).

Detalhes completos da migração (SQLite→Postgres, GitHub Pages→Vercel) em [`docs/Roadmap.md`](docs/Roadmap.md).

---

## 🗺️ Roadmap

Migração para Supabase + Vercel **concluída** — histórico completo em [`docs/Roadmap.md`](docs/Roadmap.md).

Próximos passos:
- [ ] Sincronização offline → online das tarefas criadas localmente
- [ ] OAuth real (Apple / Google) e notificações da rede de apoio
- [ ] Recorrência automática de tarefas (sugerida pela IA)

---

## 📄 Licença

Projeto em desenvolvimento. Uso e distribuição a definir pelo autor.

---

<p align="center">Feito com 💗 para deixar a sua mente mais leve.</p>
