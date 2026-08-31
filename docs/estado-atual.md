# 📍 Estado Atual do MenteLeve

> Retrato do aplicativo em **31/08/2026**, após a Sprint 8.
> Para o histórico de como se chegou aqui, veja [`historico-sprints.md`](historico-sprints.md).

---

## Em uma frase

Aplicativo de gestão de **carga mental** para mulheres e mães, no ar como PWA
instalável, com autenticação real, banco Postgres gerenciado, IA que cria e conclui
tarefas por conversa, e o conteúdo das tarefas criptografado no banco.

## No ar

| | Endereço | Hospedagem |
|---|---|---|
| **App (PWA)** | https://mente-leve-teal.vercel.app | Vercel |
| **API** | https://menteleve.onrender.com · [`/docs`](https://menteleve.onrender.com/docs) | Render |
| **Banco** | Postgres (Session pooler, IPv4) | Supabase |

Custo mensal: **R$ 0** — tudo em plano gratuito.

---

## O que funciona de verdade

- **Cadastro e login** por e-mail + senha (bcrypt + JWT). Sessão de 30 dias, revalidada
  no boot; expirou, o app volta ao login sozinho.
- **Tarefas** com categoria, prioridade, data e horário. Subtarefas fixadas na
  tarefa-mãe. Exclusão em cascata.
- **Criação inteligente** (`/tasks/smart`): texto livre vira título normalizado, data,
  horário, categoria, subtarefas sugeridas e um lembrete preventivo — o *Aha Moment*.
- **Bruna, a assistente que age**: pelo chat, cria e conclui tarefas de verdade
  (*function calling*). Excluir ficou de fora de propósito.
- **Agenda** em calendário mensal navegável.
- **Calendário menstrual** — fases, período fértil, ovulação e previsão. **100% local**,
  nunca vai ao backend.
- **Feedback sonoro** sintetizado: concluir, desfazer, Aha Moment, resposta da Bruna,
  registro do ciclo, toques de navegação e erro. Três níveis no Perfil — **Todos os
  sons / Só conclusões / Silencioso**.
- **PWA instalável**, com modo offline: 264 KB de precache em disco, ~149 KB
  transferidos (o gzip do servidor comprime os textos; as imagens já chegam
  comprimidas). O que a usuária cria, conclui ou apaga sem rede entra numa **fila
  persistida** e sobe sozinho quando a conexão volta.

## O que é fachada

Visual completo, ação simulada — proposital, para medir interesse:

- **Rede de apoio** (Conexões): não há convite real nem notificação.
- **Paywall Premium**: a assinatura é simulada, não há cobrança.
- **Login social (Apple/Google)**: botões desabilitados com aviso "em breve".
- Itens do menu do Perfil, exceto o seletor de nível de som, mostram
  "Recurso disponível na versão final".

---

## Como está construído

| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML + CSS + **JavaScript Vanilla (ES Modules)**, Tailwind via CDN. **Sem build step.** PWA (manifest + Service Worker) |
| **Backend** | **FastAPI** + SQLAlchemy 2.0 + Pydantic v2, Uvicorn |
| **Banco** | **PostgreSQL** (Supabase), driver `psycopg` |
| **Autenticação** | bcrypt (senhas) + PyJWT (tokens HS256) |
| **Criptografia** | AES-256-GCM (`cryptography`) no conteúdo em repouso |
| **IA** | Google **Gemini** `2.5-flash`, com **Groq** de reserva — REST puro, sem SDK |

Design System **Bordeaux Pink** (60:30:10): fundo `#fff0f3`, estrutura `#590d22`,
destaque `#ff4d6d`.

### Decisões que valem conhecer antes de mexer

- **Sem framework e sem build no frontend.** Editar arquivo e recarregar é o ciclo
  inteiro. Foi o que permitiu entregar rápido; o custo é não ter componentização.
- **Sem Alembic.** As migrações são aditivas e rodam no boot (`database.py`):
  `_ensure_columns()` adiciona colunas, `_widen_columns()` converte tipos. Falha ali
  só gera aviso — derrubar o boot deixaria a API inteira fora do ar.
- **Local-first.** O app funciona sem backend, com tarefas de demonstração. O estado
  vive no `localStorage`, e o sync faz *upsert por id* — nunca substitui a lista, o que
  apagaria tarefas criadas offline.
- **Data é estruturada** (`due_date` + `due_time`); o rótulo ("Hoje", "Amanhã • 10:00")
  é derivado na exibição, nunca armazenado. Guardar o texto criava duas fontes de
  verdade. Cuidado: `new Date('2026-08-27')` é meia-noite **UTC** e volta um dia no
  Brasil — use `dates.js`.
- **A Bruna nunca informa um id.** Ela diz o título e o servidor casa contra as tarefas
  da própria usuária. Elimina a classe de erro "modelo inventa um id".
- **Coluna criptografada não se compara em SQL.** `WHERE title = 'x'`, `LIKE` e
  `ORDER BY` alfabético nunca casam — comparam contra ciphertext. Filtre em Python.

---

## Segurança

| Camada | Como está |
|---|---|
| **Rotas** | Toda rota de dados exige JWT. Além do login, há checagem de **posse** por tarefa, respondendo `404` para não confirmar que a tarefa existe |
| **Senhas** | bcrypt com salt por senha; nunca gravada nem registrada em log |
| **Conteúdo no banco** | **AES-256-GCM** em `tasks.title` e `users.name`. Um dump do Postgres mostra `v1:<base64>` |
| **Em trânsito** | HTTPS ponta a ponta |

Legível de propósito: **e-mail** (chave de busca do login, índice UNIQUE), **data**,
**categoria** e **status** — sustentam o calendário e os índices. O banco revela
*quando*, não *o quê*.

### Limites conhecidos

- A `ENCRYPTION_KEY` e o banco ficam ambos no Render — comprometer essa conta entrega os dois.
- A **Bruna envia o texto das tarefas ao Google e ao Groq**. Nenhuma criptografia no
  banco muda isso. O tier gratuito dos dois permite uso do conteúdo para treinamento.
- O limite de tentativas do `/auth/login` **vive na memória do processo**. No Render free
  há uma só instância, então a contagem é exata; com mais de uma, o teto efetivo passa a
  ser `limite × instâncias`.
- O `localStorage` guarda as tarefas em texto puro — é o que faz o offline funcionar.
- **RLS do Supabase não é usada**, e não adiantaria: o backend conecta com a role
  `postgres`, que a ignora. O isolamento está na aplicação. RLS só faria sentido se o
  frontend falasse direto com o Supabase, o que não acontece.

> ⚠️ **Perder a `ENCRYPTION_KEY` torna os dados já gravados irrecuperáveis.**

---

## Variáveis de ambiente (Render)

| Variável | Obrigatória | Se faltar |
|---|---|---|
| `DATABASE_URL` | **sim** | cai no SQLite local |
| `SECRET_KEY` | **sim** | chave aleatória por processo — **desloga todo mundo a cada restart** |
| `ENCRYPTION_KEY` | **sim** | grava em texto puro e avisa no log |
| `CORS_ORIGINS` | sim | o frontend na Vercel é bloqueado |
| `SIMULATED_CHECKOUT` | não | padrão `true`: a compra simulada do MVP segue ativa. Ponha `false` antes de cobrar |
| `LOGIN_MAX_ATTEMPTS` | não | padrão 8 falhas por e-mail em 15 min (30 por IP) |
| `GOOGLE_AI_API_KEY` | não | IA cai no fallback (só normaliza o título) |
| `GROQ_API_KEY` | não | sem reserva quando o Gemini estoura a cota |
| `PYTHON_VERSION=3.12.8` | sim | build pode escolher versão sem wheels |

`SECRET_KEY` e `ENCRYPTION_KEY` são valores **diferentes**, gerados com
`python -c "import secrets; print(secrets.token_hex(32))"`.

---

## Pendências conhecidas

**Precisa ser resolvido antes de cobrar de verdade**
- ~~`POST /auth/me/premium?is_premium=true` permite que qualquer usuária autenticada se
  conceda Premium.~~ **Resolvido na Sprint 6.** A concessão agora tem rota própria
  (`POST /auth/me/premium/simulate`), fechada pela variável `SIMULATED_CHECKOUT`.
  Basta desligá-la para que só uma confirmação de pagamento no servidor conceda Premium.

**Segurança**
- ~~Limite de tentativas em `/auth/login`.~~ **Resolvido na Sprint 6** — janela
  deslizante em memória por e-mail e por IP, contando só as falhas.
- `users.name` da conta `Admin` ainda está em texto puro (anterior à criptografia).
  Converter com `python scripts/encrypt_existing.py --aplicar`.

**Funcionalidade**
- ~~Não há **fila de escrita offline → online**.~~ **Resolvida na Sprint 6:** criação,
  conclusão e exclusão feitas sem rede entram numa fila persistida e sobem quando a
  conexão volta.
- **Recorrência de tarefas** precisa de coluna própria (foi removida do prompt da IA
  porque o schema não a representava e ela gerava lixo por construção).
- **OAuth real** (Apple/Google) e notificações da rede de apoio.

**Operacional**
- Plano gratuito do Gemini: ~20 requisições/minuto. Estoura fácil; por isso existe a
  reserva no Groq.
- O Render free dorme após ~15 min. Mitigado com ping externo em `/health` a cada 10 min.

---

## Onde as coisas estão

```
Frontend/js/
├── app.js          bootstrap + mini-router (deep-link por hash)
├── store.js        estado + localStorage + sincronização
├── api.js          cliente REST (JWT) + heurística local de fallback
├── dates.js        prazo estruturado: resolução e exibição
├── sound.js        feedback sonoro sintetizado (Web Audio)
└── views/          onboarding, login, register, home, agenda,
                    chat (Bruna), connections, paywall, profile

Backend/app/
├── main.py         FastAPI, CORS, /health, avisos de boot
├── config.py       settings via .env
├── database.py     engine + micro-migrações no boot
├── security.py     bcrypt (senhas) + JWT (tokens)
├── ratelimit.py    janela deslizante em memória (tentativas de login)
├── crypto.py       AES-256-GCM (EncryptedText)
├── ai.py           Gemini + Groq (analyze, chat, function calling)
└── routers/        auth, tasks (+ /tasks/smart), ai_chat (Bruna)
```

Documentação de referência: [`../README.md`](../README.md) (visão geral e deploy),
[`../Backend/README.md`](../Backend/README.md) (API, IA e criptografia em detalhe),
[`../Frontend/README.md`](../Frontend/README.md) (PWA, datas, som, offline).
