# MenteLeve — Backend (API)

API REST em **FastAPI + SQLite (SQLAlchemy)**. Esta fase entrega o CRUD completo
de tarefas e o login simplificado. **A Inteligência Artificial ainda não está
plugada** — a rota `/tasks/smart` apenas persiste a tarefa e devolve o formato
que o frontend espera (com `subtasks` vazio e `suggestion` nulo).

## Stack
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + SQLite
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
│   ├── database.py      # engine SQLite, sessão, init_db()
│   ├── models.py        # User, Task
│   ├── schemas.py       # Pydantic (entrada/saída) + FREE_TASK_LIMIT
│   ├── crud.py          # operações de banco
│   ├── dependencies.py  # auth leve via header X-User-Id
│   └── routers/
│       ├── auth.py      # /auth/login, /auth/me, /auth/me/premium
│       └── tasks.py     # CRUD de tarefas + /tasks/smart (stub sem IA)
├── requirements.txt
├── Procfile             # deploy (Render): uvicorn ...
├── .env.example
└── .gitignore
```

## Autenticação (MVP)

Sem OAuth/senha nesta fase. Fluxo:
1. `POST /auth/login` com `{ "email": "...", "name": "..." }` → retorna o usuário com `id`.
2. O frontend guarda o `id` e o envia no header **`X-User-Id`** nas demais chamadas.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Ping (usado pelo frontend) |
| POST | `/auth/login` | Login/registro por e-mail |
| GET | `/auth/me` | Dados do usuário atual |
| POST | `/auth/me/premium?is_premium=true` | Ativa/desativa Premium |
| GET | `/tasks` | Lista tarefas do usuário |
| POST | `/tasks` | Cria tarefa (campos completos) |
| POST | `/tasks/smart` | Cria a partir de texto (`{text}`) — **sem IA ainda** |
| PATCH | `/tasks/{id}` | Atualiza tarefa |
| PUT | `/tasks/{id}/complete` | Marca como concluída |
| PUT | `/tasks/{id}/uncomplete` | Reabre a tarefa |
| DELETE | `/tasks/{id}` | Exclui tarefa |

Todas as rotas de `/tasks` e `/auth/me*` exigem o header `X-User-Id`.

## Freemium
Usuários não-Premium têm limite de **50 tarefas** (`FREE_TASK_LIMIT`). Ao exceder,
a criação retorna **HTTP 402** (gatilho do Paywall no frontend).

## Deploy (Render)
- Build: `pip install -r requirements.txt`
- Start: definido no `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- **Importante:** configure um *Disk* persistente e aponte `DATABASE_URL` para ele
  (ex.: `sqlite:////var/data/menteleve.db`), senão o banco é perdido a cada deploy.

## Próximo passo
Plugar a IA (Google AI Studio) na rota `/tasks/smart` — ver o `TODO(IA)` em
`app/routers/tasks.py`.
