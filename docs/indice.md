# 📑 Documentação completa — MenteLeve

> Toda a documentação do projeto num arquivo só. Atualizado em 29/09/2026.
> As Partes 1–3 **vivem apenas aqui** (os arquivos originais foram removidos).
> As Partes 4–6 são **cópias** dos READMEs, que continuam nos seus lugares — se editar
> um README, atualize a cópia aqui também.
> O plano de ampliação fica à parte: [plano_migracao_vida_trabalho.md](plano_migracao_vida_trabalho.md).

## Sumário

- [Parte 1 — Contexto do produto](#parte-1--contexto-do-produto)
- [Parte 2 — Documentação consolidada](#parte-2--documentação-consolidada)
- [Parte 3 — Histórico de melhorias](#parte-3--histórico-de-melhorias)
- [Parte 4 — README do projeto (cópia)](#parte-4--readme-do-projeto-cópia)
- [Parte 5 — README do Backend (cópia)](#parte-5--readme-do-backend-cópia)
- [Parte 6 — README do Frontend (cópia)](#parte-6--readme-do-frontend-cópia)

## Mudanças na reorganização de 29/09/2026

- **Removido** `docs/melhorias.md`: especificação escrita para outra stack (React/TSX em `src/routes/`), não correspondia ao projeto.
- **Recortados para este arquivo**: `docs/contexto_menteleve.md`, `docs/README.md` e `DOCS_MELHORIAS_IMPLEMENTADAS.md` (antes movido para `docs/historico_melhorias.md`).
- **Corrigido**: recorrência e suíte de testes constavam como inexistentes (já existem; falta CI); Social Login e Rede de Apoio constavam como funcionais (são fachada).

---

## Parte 1 — Contexto do produto

## Contexto do Aplicativo: MenteLeve

> **Atualizado em 01/10/2026:** o MenteLeve deixou de ser um app só para mulheres e mães e passou a ser uma **agenda para profissionais do mercado de trabalho**, que reúne trabalho e vida pessoal. A migração segue o [plano de migração](plano_migracao_vida_trabalho.md) (Fases 1 a 5 entregues).

### 1. Visão Geral
O **MenteLeve** é uma agenda inteligente para quem concilia trabalho e vida pessoal, projetada para atuar como um "Segundo Cérebro" (Second Brain). Seu principal objetivo é ajudar profissionais a organizarem reuniões, entregas, estudos e compromissos pessoais de forma fluida, reduzindo a sobrecarga mental através de uma interface sem atrito e do uso prático de Inteligência Artificial. Mulheres e mães, o público original, continuam sendo atendidos — o app só deixou de presumir quem a pessoa é.

### 2. A Dor e o Problema
A premissa central é que *"a sua mente não foi feita para guardar tudo"*. A gestão simultânea de reuniões, prazos, estudos, casa, família e vida pessoal exige um esforço invisível e contínuo, e é uma fonte conhecida de estresse e burnout. Muitas vezes, as ferramentas tradicionais de produtividade falham por serem muito complexas, e o próprio ato de registrar ou delegar uma tarefa a alguém acaba gerando mais fricção do que a execução em si.

### 3. A Solução e Funcionalidades Principais
O MVP do MenteLeve foca em velocidade de navegação e entrega imediata de valor (Aha Moment), com os seguintes pilares:

* **Onboarding e Acesso Sem Atrito:** Fluxos rápidos de cadastro por e-mail e senha. Social Login (Apple/Google) está planejado, hoje aparece como "em breve".
* **Criação Inteligente de Tarefas (NLP e IA):** A pessoa digita ou fala de forma natural ("reunião com o cliente sexta às 10h"). A Inteligência Artificial atua nos bastidores sugerindo subtarefas (pauta, convite, ata), lembretes ou automações (o *Aha Moment*), pensando nos detalhes antes da própria pessoa.
* **Trabalho e Vida no mesmo lugar:** 9 categorias em dois grupos — Trabalho (trabalho, reuniões, carreira, estudos) e Vida (casa, família, saúde, finanças, pessoal) — com filtro Tudo / Trabalho / Vida na Home e na Agenda. O onboarding pergunta para que a pessoa vai usar o app e define o filtro inicial.
* **Tarefas recorrentes:** diária, semanal ou mensal (reunião semanal, relatório do mês).
* **Compartilhamento / Rede de Apoio:** Visão de convidar familiares ou colegas de equipe para dividir responsabilidades. Hoje é fachada (tela pronta, sem convite real).
* **Módulos opcionais:** o calendário menstrual (100% privado, só no aparelho) é um módulo desligado por padrão, ativado em Perfil. Quem já o usava continua com ele ligado.
* **Micro-interações de Recompensa:** O app utiliza efeitos visuais (fade-outs suaves) e sonoros prazerosos ao concluir uma pendência, liberando endorfina e incentivando o uso contínuo.

### 4. Identidade Visual (Design System: Bordeaux Pink + temas)
A interface foi rigorosamente pensada para não gerar estresse visual, guiando-se pela regra 60:30:10. O **Bordeaux Pink** é o tema padrão; a pessoa pode trocar a cor do app em Perfil → Cor do app (Oceano, Floresta, Grafite e Lavanda), e todas as paletas passam no contraste de texto AA. A paleta padrão, sofisticada e acolhedora:
* **Fundo (60%):** O *Lavender Blush* (#fff0f3) substitui o branco clínico ou cinza, criando um ambiente de leveza e conforto logo no primeiro contato.
* **Estrutura (30%):** O *Night Bordeaux* (#590d22) e tons de vinho trazem elegância, contraste e clareza para a tipografia e cabeçalhos.
* **Ação (10%):** O *Bubblegum Pink* (#ff4d6d) é a cor de sotaque (accent), usada estrategicamente para guiar a atenção aos botões de conversão e elementos interativos essenciais.

**Logotipo:** uma folha de agenda com uma folha ("leve") e a faísca da IA, em SVG que usa as cores do tema ativo. Os ícones do PWA (que são arquivos fixos e não acompanham o tema) usam uma versão neutra em grafite. O logotipo anterior (silhueta feminina com borboleta, em rosa) foi aposentado.

### 5. Modelo de Negócios
O MenteLeve é 100% gratuito, sem limite de tarefas nem plano pago — o modelo Freemium/Paywall descrito em versões anteriores deste documento foi descontinuado. Todos os recursos de organização de tarefas ficam disponíveis para qualquer pessoa cadastrada, sem trava de uso.

---

## Parte 2 — Documentação consolidada

## 📚 Documentação — MenteLeve

> Documento único: estado atual, design system, diretrizes de UX e histórico de
> sprints. Consolidado em 01/09/2026 a partir dos documentos que existiam em `docs/`
> — o conteúdo específico de cada sprint foi condensado aqui; os arquivos originais
> foram removidos para não duplicar informação. A visão de produto (o quê e o porquê
> do app) continua em [`contexto_menteleve.md`](#parte-1--contexto-do-produto), que não foi
> tocado.

### Índice

1. [Visão geral](#1-visão-geral)
2. [Estado atual do produto](#2-estado-atual-do-produto)
3. [Design system — Bordeaux Pink](#3-design-system--bordeaux-pink)
4. [Diretrizes Mobile × Desktop](#4-diretrizes-mobile--desktop)
5. [Método de planejamento e restrições](#5-método-de-planejamento-e-restrições)
6. [Histórico de sprints](#6-histórico-de-sprints)
7. [Ideias futuras / backlog de produto](#7-ideias-futuras--backlog-de-produto)
8. [Documentos relacionados](#8-documentos-relacionados)

---

### 1. Visão geral

O **MenteLeve** é uma agenda inteligente para profissionais do mercado de trabalho —
um "segundo cérebro" que reúne trabalho e vida pessoal e reduz a sobrecarga com uma
assistente de IA (Bruna) que organiza e antecipa tarefas, 100% gratuito, sem limite de
tarefas nem plano pago. A dor e a proposta de valor estão descritas em detalhe em
[`contexto_menteleve.md`](#parte-1--contexto-do-produto) — não repetido aqui.

O restante deste documento cobre o que já existe de fato: arquitetura, decisões
técnicas, design system, diretrizes de UX e o histórico de como o produto chegou
ao estado atual.

---

### 2. Estado atual do produto

> Retrato do aplicativo em **31/08/2026**, após a Sprint 8.

#### Em uma frase

Agenda inteligente para **trabalho e vida pessoal**, no ar como PWA
instalável, com autenticação real, banco Postgres gerenciado, IA que cria e conclui
tarefas por conversa, e o conteúdo das tarefas criptografado no banco.

#### No ar

| | Endereço | Hospedagem |
|---|---|---|
| **App (PWA)** | https://mente-leve-teal.vercel.app | Vercel |
| **API** | https://menteleve.onrender.com · [`/docs`](https://menteleve.onrender.com/docs) | Render |
| **Banco** | Postgres (Session pooler, IPv4) | Supabase |

Custo mensal: **R$ 0** — tudo em plano gratuito.

#### O que funciona de verdade

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
  persistida** e sobe sozinha quando a conexão volta.
- **IA assíncrona com circuit breaker** (Gemini + Groq de reserva): chamadas não
  bloqueiam mais o processo do backend — ver [`Backend/app/ai.py`](../Backend/app/ai.py)
  e [`Backend/app/circuit.py`](../Backend/app/circuit.py).
- **Lembrete de tarefa por notificação push** (opt-in, no Perfil): um cron externo
  chama `POST /push/scan` a cada poucos minutos; tarefas com horário dentro da janela
  configurada disparam um Web Push (VAPID) para os aparelhos inscritos da usuária —
  ver [`Backend/app/push.py`](../Backend/app/push.py) e
  [`Frontend/js/push.js`](../Frontend/js/push.js). Requer configuração manual (chaves
  VAPID + cron) — ver variáveis de ambiente abaixo.

#### O que é fachada

Visual completo, ação simulada — proposital, para medir interesse:

- **Rede de apoio** (Conexões): não há convite real nem notificação.
- **Login social (Apple/Google)**: botões desabilitados com aviso "em breve".
- Itens do menu do Perfil, exceto o seletor de nível de som, mostram
  "Recurso disponível na versão final".

#### Como está construído

| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML + CSS + **JavaScript Vanilla (ES Modules)**, Tailwind via CDN. **Sem build step.** PWA (manifest + Service Worker) |
| **Backend** | **FastAPI** (rotas de IA assíncronas) + SQLAlchemy 2.0 + Pydantic v2, Uvicorn |
| **Banco** | **PostgreSQL** (Supabase), driver `psycopg` |
| **Autenticação** | bcrypt (senhas) + PyJWT (tokens HS256) |
| **Criptografia** | AES-256-GCM (`cryptography`) no conteúdo em repouso |
| **IA** | Google **Gemini** `2.5-flash`, com **Groq** de reserva — `httpx` assíncrono + circuit breaker |

Design System **Bordeaux Pink** (60:30:10): fundo `#fff0f3`, estrutura `#590d22`,
destaque `#ff4d6d` — detalhado na [seção 3](#3-design-system--bordeaux-pink).

#### Decisões que valem conhecer antes de mexer

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
- **Chamadas de IA são assíncronas e têm circuit breaker.** `ai.py` usa
  `httpx.AsyncClient`; o Gemini é protegido por um `CircuitBreaker` (3 falhas seguidas
  → 30s de cooldown) para não pagar o timeout inteiro em toda requisição durante uma
  indisponibilidade. As rotas `/tasks/smart` e `/ai/chat` são `async def`; o trabalho
  síncrono de banco dentro delas roda em `asyncio.to_thread` para não bloquear o
  event loop.
- **O lembrete push assume fuso de Brasília fixo (UTC-3).** O app não guarda fuso
  por usuária; como o Brasil não observa horário de verão desde 2019, isso é uma
  simplificação deliberada, não um descuido — só afeta quem usa o app fora desse fuso.
- **Uma inscrição de push quebrada nunca derruba a varredura inteira.** `push.py`
  isola falha por inscrição (`except Exception`, não só `WebPushException`) — uma
  chave malformada pode levantar `ValueError` bem antes de qualquer chamada de rede,
  dentro da própria cifragem do payload. Encontrado testando, não hipotético.

#### Segurança

| Camada | Como está |
|---|---|
| **Rotas** | Toda rota de dados exige JWT. Além do login, há checagem de **posse** por tarefa, respondendo `404` para não confirmar que a tarefa existe |
| **Senhas** | bcrypt com salt por senha; nunca gravada nem registrada em log |
| **Conteúdo no banco** | **AES-256-GCM** em `tasks.title` e `users.name`. Um dump do Postgres mostra `v1:<base64>` |
| **Em trânsito** | HTTPS ponta a ponta |

Legível de propósito: **e-mail** (chave de busca do login, índice UNIQUE), **data**,
**categoria** e **status** — sustentam o calendário e os índices. O banco revela
*quando*, não *o quê*.

##### Limites conhecidos

- A `ENCRYPTION_KEY` e o banco ficam ambos no Render — comprometer essa conta entrega os dois.
- A **Bruna envia o texto das tarefas ao Google e ao Groq**. Nenhuma criptografia no
  banco muda isso. O tier gratuito dos dois permite uso do conteúdo para treinamento.
- O limite de tentativas do `/auth/login` **vive na memória do processo**. No Render free
  há uma só instância, então a contagem é exata; com mais de uma, o teto efetivo passa a
  ser `limite × instâncias`. O mesmo vale para o circuit breaker da IA (ver acima).
- O `localStorage` guarda as tarefas em texto puro — é o que faz o offline funcionar.
- **RLS do Supabase não é usada**, e não adiantaria: o backend conecta com a role
  `postgres`, que a ignora. O isolamento está na aplicação. RLS só faria sentido se o
  frontend falasse direto com o Supabase, o que não acontece.
- **Não existe fluxo de recuperação de senha.** Uma usuária que esquece a senha não
  tem caminho de autoatendimento hoje.
- **Sem revogação de sessão.** O JWT vale 30 dias e não há como invalidar um token
  específico antes de expirar (ex.: aparelho perdido).

> ⚠️ **Perder a `ENCRYPTION_KEY` torna os dados já gravados irrecuperáveis.**

#### Variáveis de ambiente (Render)

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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | não | lembrete push fica desligado (Perfil não mostra a opção) — gerar com `python scripts/generate_vapid_keys.py` |
| `VAPID_CONTACT_EMAIL` | não | usa um e-mail placeholder no claim exigido pelo protocolo Web Push |
| `PUSH_SCAN_SECRET` | não | `POST /push/scan` fica fechado (503) — sem ele, nunca aberto por omissão |
| `PUSH_REMINDER_WINDOW_MINUTES` | não | padrão 10 minutos de antecedência |

`SECRET_KEY` e `ENCRYPTION_KEY` são valores **diferentes**, gerados com
`python -c "import secrets; print(secrets.token_hex(32))"`.

#### Pendências conhecidas

**Segurança / retenção — sem dono ainda**
- Não há fluxo de **recuperação de senha** (self-service). Maior risco de churn silencioso do produto hoje.
- Sem **revogação de sessão** (logout remoto / token comprometido).
- `users.name` da conta `Admin` ainda está em texto puro (anterior à criptografia).
  Converter com `python scripts/encrypt_existing.py --aplicar`.

**Funcionalidade**
- **Recorrência** já existe (`daily`/`weekly`/`monthly` — ver
  [`historico_melhorias.md`](#parte-3--histórico-de-melhorias)). Falta: dias específicos da
  semana, data de término e a IA *sugerir* ciclos por conta própria.
- **OAuth real** (Apple/Google) e notificações da rede de apoio.

**Operacional**
- Plano gratuito do Gemini: ~20 requisições/minuto. Estoura fácil; por isso existe a
  reserva no Groq e o circuit breaker.
- O Render free dorme após ~15 min. Mitigado com ping externo em `/health` a cada 10 min.
- **Lembrete push implementado, mas precisa de setup manual antes de funcionar em
  produção:** gerar as chaves VAPID (`python scripts/generate_vapid_keys.py`),
  definir as variáveis de ambiente no Render, e cadastrar um cron externo (mesmo
  serviço usado no ping do `/health`) batendo em `POST /push/scan` com o header
  `X-Scan-Secret` a cada poucos minutos.

**Testes**
- Suíte existe (`pytest` no backend, `node --test` no frontend), mas **não há CI** —
  os testes só rodam se alguém lembrar de rodá-los.

#### Onde as coisas estão

```
Frontend/js/
├── app.js          bootstrap + mini-router (deep-link por hash)
├── store.js        estado + localStorage + sincronização
├── api.js          cliente REST (JWT) + heurística local de fallback
├── dates.js        prazo estruturado: resolução e exibição
├── sound.js        feedback sonoro sintetizado (Web Audio)
├── push.js         notificação push: permissão, subscribe/unsubscribe
└── views/          onboarding, login, register, home, agenda,
                    chat (Bruna), connections, profile

Backend/app/
├── main.py         FastAPI, CORS, /health, avisos de boot
├── config.py       settings via .env
├── database.py     engine + micro-migrações no boot
├── security.py     bcrypt (senhas) + JWT (tokens)
├── ratelimit.py    janela deslizante em memória (tentativas de login)
├── circuit.py      circuit breaker em memória (chamadas ao Gemini)
├── crypto.py       AES-256-GCM (EncryptedText)
├── ai.py           Gemini + Groq assíncronos (analyze, chat, function calling)
├── push.py         envio de Web Push (VAPID) para lembrete de tarefa
└── routers/        auth, tasks (+ /tasks/smart), ai_chat (Bruna), push (scan + subscribe)
```

Documentação de referência: [`../README.md`](../README.md) (visão geral e deploy),
[`../Backend/README.md`](../Backend/README.md) (API, IA e criptografia em detalhe),
[`../Frontend/README.md`](../Frontend/README.md) (PWA, datas, som, offline).

---

### 3. Design system — Bordeaux Pink

> **Atualização (01/10/2026):** o Bordeaux Pink agora é o **tema padrão** de 5 (Oceano,
> Floresta, Grafite e Lavanda são os outros), escolhidos em Perfil → Cor do app. A paleta
> abaixo segue valendo para o padrão; os temas só redefinem os mesmos tokens. Detalhes na
> [Parte 6](#parte-6--readme-do-frontend-cópia), seção "Temas de cor".


Identidade visual que combina tons profundos de bordeaux com rosas vibrantes e
neutros suaves. Personalidade: **sofisticada, romântica, moderna, confiante,
elegante, acolhedora.**

#### Paleta oficial

**Primárias**

| Nome | Cor | Uso |
|---|---|---|
| Night Bordeaux | `#590d22` | Fundo principal, superfícies escuras |
| Dark Amaranth | `#800f2f` | Elementos estruturais e navegação |
| Cherry Rose | `#a4133c` | Componentes primários |

**Secundárias**

| Nome | Cor | Uso |
|---|---|---|
| Rosewood | `#c9184a` | Destaques e estados ativos |
| Bubblegum Pink | `#ff4d6d` | CTA principal |
| Bubblegum Pink Soft | `#ff758f` | Hover e interações |

**Apoio**

| Nome | Cor | Uso |
|---|---|---|
| Cotton Candy | `#ff8fa3` | Cards suaves |
| Cherry Blossom | `#ffb3c1` | Backgrounds secundários |
| Pastel Petal | `#ffccd5` | Áreas de destaque suaves |
| Lavender Blush | `#fff0f3` | Fundo claro principal |

#### Regra 60:30:10

- **60% — Lavender Blush (`#fff0f3`):** fundo principal, telas, containers, modais,
  áreas de leitura. Objetivo: leveza, limpeza, conforto visual.
- **30% — Night Bordeaux (`#590d22`):** navbar, sidebar, cabeçalhos, rodapés, títulos
  principais, superfícies premium. Objetivo: sofisticação, autoridade, identidade.
- **10% — Bubblegum Pink (`#ff4d6d`):** botões CTA, links importantes, indicadores
  ativos, badges, estados de sucesso visual. Objetivo: atrair atenção imediata.

#### Hierarquia de texto

| Elemento | Cor |
|---|---|
| Título H1 | `#590d22` |
| Título H2 | `#800f2f` |
| Corpo | `#590d22` |
| Texto secundário | `#a4133c` |
| Texto desabilitado | `#ff8fa3` |

#### Botões

**Primary** — fundo `#ff4d6d`, texto `#ffffff`, hover `#ff758f`, pressed `#c9184a`.
**Secondary** — fundo transparente, borda `#800f2f`, texto `#800f2f`, hover `#ffccd5`.
**Ghost** — texto `#a4133c`, hover `#fff0f3`.

#### Inputs

- **Normal:** borda `#ffccd5`, fundo `#ffffff`.
- **Focus:** borda `#ff4d6d`, shadow `0 0 0 4px rgba(255,77,109,.15)`.
- **Error:** borda `#c9184a`.

#### Cards

- **Padrão:** fundo `#ffffff`, borda `#ffccd5`, shadow `0 8px 24px rgba(89,13,34,.08)`.
- **Destaque:** fundo `#ffb3c1`, borda `#ff758f`.

#### Estados do sistema

Success `#ff4d6d` · Warning `#ff8fa3` · Error `#c9184a` · Info `#a4133c`.

#### Gradientes recomendados

```css
/* Hero */
linear-gradient(135deg, #590d22 0%, #800f2f 50%, #c9184a 100%)

/* CTA */
linear-gradient(135deg, #ff4d6d 0%, #ff758f 100%)

/* Soft Background */
linear-gradient(180deg, #fff0f3 0%, #ffccd5 100%)
```

#### Tokens CSS

```css
:root {
  --color-bg: #fff0f3;

  --color-primary-900: #590d22;
  --color-primary-800: #800f2f;
  --color-primary-700: #a4133c;
  --color-primary-600: #c9184a;

  --color-accent: #ff4d6d;
  --color-accent-hover: #ff758f;

  --color-soft-300: #ff8fa3;
  --color-soft-200: #ffb3c1;
  --color-soft-100: #ffccd5;

  --color-surface: #ffffff;

  --text-primary: #590d22;
  --text-secondary: #800f2f;
}
```

#### Regras de uso

**Faça:** use Lavender Blush como fundo principal · Night Bordeaux para estrutura e
tipografia · Bubblegum Pink apenas para chamar atenção · mantenha contraste alto ·
preserve o 60:30:10 em toda tela.

**Evite:** grandes áreas em Bubblegum Pink · texto longo sobre fundo Bubblegum Pink ·
misturar mais de três tons fortes na mesma tela · usar Rosewood e Bubblegum Pink
simultaneamente em CTAs concorrentes.

A identidade deve transmitir **elegância + romance + sofisticação + modernidade**,
com a distribuição 60/30/10 mantida em todas as telas.

---

### 4. Diretrizes Mobile × Desktop

Estratégia de UX/UI adaptativa para o MenteLeve PWA: mobile é o uso principal,
desktop é acesso complementar. Independente do dispositivo, o app mantém a promessa
de redução de sobrecarga — o princípio orientador é **"spa mental"**: se o desktop
parecer um cockpit de avião, o design falhou na proposta de valor.

#### Princípios

- **Densidade:** mantenha o respiro (white space). Desktop é uma versão expandida e
  focada, não um "dashboard financeiro denso".
- **Foco:** a IA é o centro. Onde a usuária estiver, o gatilho da IA deve ser visível.
- **Identidade:** paleta Bordeaux Pink consistente; só estados de erro/sucesso destoam.

#### Adaptação por categoria

| Categoria | Mobile (ação/rapidez) | Desktop (visão geral) |
|---|---|---|
| Dashboard | Lista vertical (checklist) | Sidebar (agenda semanal) + lista principal |
| Nova Tarefa (IA) | Bottom Sheet (polegar) | Modal central (teclado/foco) |
| Navegação | Bottom Bar | Sidebar lateral fixa |
| Pop-up da IA | Fullscreen ou 80% do ecrã | Modal central pequeno (pop-over) |
| Interações | Swipe para concluir | Checkbox explícito |

#### Diretrizes específicas

- **Criação de tarefas:** mobile prioriza digitar/ditar rápido (usuária na rua ou
  ocupada); desktop pode mostrar o "plano" da IA maior, com edição rápida das
  subtarefas antes de salvar.
- **Agenda:** mobile mostra "Agenda do Dia" (timeline vertical, foco no *agora*);
  desktop aproveita a largura para a visão semanal, evitando a surpresa do "amanhã".
- **Gesto vs. mouse:** swipe no mobile; ícones de ação visíveis só no hover (tons de
  Cherry Rose, discretos) no desktop.
- **Espaço extra no desktop** é para planejamento de longo prazo, não para mais botões.
- **FAB "Adicionar"** ancorado no canto inferior direito em qualquer tamanho de tela —
  preserva a memória muscular de quem alterna entre celular e PC.

---

### 5. Método de planejamento e restrições

#### Restrições invioláveis

Qualquer proposta que quebre uma destas linhas é descartada antes de ser avaliada —
não são preferências, são o que faz o produto funcionar hoje.

| Restrição | Por quê |
|---|---|
| **Sem build step** | O ciclo é editar arquivo e recarregar. Bundler custaria mais do que qualquer biblioteca economiza |
| **Precache ≤ ~150 KB transferidos** | Offline real em rede instável. Cada dependência nova pesa para toda usuária; cada uma que falta quebra o offline em silêncio |
| **`prefers-reduced-motion` respeitado** | Público-alvo em sobrecarga; movimento involuntário é hostil |
| **Áudio sintetizado, nunca arquivo** | `sound.js` gera tudo pela Web Audio API: zero byte, zero licença, zero 404 offline |
| **Som sempre opcional** | Interruptor no Perfil; toda função nova checa `isSoundEnabled()` antes de emitir |
| **Custo R$ 0/mês** | Vercel + Render + Supabase, todos no tier gratuito |

#### Instrumentos de priorização

Três instrumentos, cada um resolvendo um problema diferente — nenhum é decorativo:

- **Kano** — classifica a *natureza* de cada melhoria, não a ordem:
  - **Básico** (a ausência irrita, a presença não encanta): recuperação de senha,
    limite de tentativas de login, fila de escrita offline.
  - **Linear** (quanto melhor, mais satisfação): tipografia, ritmo de leitura,
    latência percebida.
  - **Encanto** (ninguém pede, todo mundo comenta): som de conclusão, revelação
    coreografada de subtarefas, ilustração viva no onboarding.

  Regra: **nenhum item de Encanto entra numa sprint enquanto houver Básico aberto.**

- **MoSCoW** — `Must` / `Should` / `Could` / `Won't` recorta o escopo de cada sprint.
  O `Won't` é documentado (ver abaixo) para não voltar à pauta a cada ciclo.

- **ICE** — `Impacto × Confiança ÷ Esforço` (cada eixo 1–5, esforço em dias-dev).
  Desempata dentro do mesmo nível Kano; não decide sozinho.

#### Definition of Done

Um item só está pronto quando **todos** valem:

1. Funciona offline (ou degrada em silêncio, sem erro visível).
2. Respeita `prefers-reduced-motion`.
3. Se emite som, respeita o interruptor do Perfil.
4. Não aumenta o precache em mais de 5 KB sem decisão explícita registrada.
5. Testado em viewport de 360 px e em desktop.
6. Sem dependência nova de CDN.

#### Cadência

Sprints de **2 semanas**. Fundação técnica (segurança, dados) é planejada em
cascata — escopo fechado, sem replanejar no meio, porque erro ali custa dado de
usuária. Camada de experiência (design, som, animação) é iterativa: entrega,
observa, ajusta.

#### `Won't` — decidido e documentado

| Proposta | Motivo |
|---|---|
| **GSAP** | Dezenas de KB via CDN para coreografia que `animation-delay` já entrega. Contradiz o precache enxuto |
| **AOS (Animate On Scroll)** | Revelar tarefas conforme a rolagem adiciona ruído a uma lista que a usuária quer ler de uma vez |
| **Swup** | O mini-router por hash com `viewEnter` já elimina o flash branco; Swup pressupõe navegação multi-página |
| **Lottie** | ~250 KB de runtime para substituir ícones vetoriais que já são SVG inline |
| **Vídeo de fundo** | Não existe *hero section*; megabytes de vídeo num produto cuja identidade é um precache enxuto |
| **Sons em arquivo (`.mp3`/`.wav`)** | Rompe a premissa do `sound.js`: peso, licenciamento e risco de 404 offline |
| **Fonte customizada no corpo** | Requisição render-blocking que o offline não honra |

#### Como medir

| Métrica | Como | Meta |
|---|---|---|
| Peso do precache | soma dos `ASSETS` do `sw.js` | ≤ 150 KB transferidos |
| Lighthouse (mobile) | Performance e Acessibilidade | ≥ 90 em ambos |
| Fidelidade offline | modo avião: fonte, ícones e tarefas | 100% dos títulos em serifa |
| Perda offline | tarefas criadas sem rede que sobem | 100% |
| Conclusão do onboarding | % que chega ao cadastro | acompanhar linha de base |
| Adoção do som | % com som ligado após 7 dias | acompanhar linha de base |

#### Riscos ativos

| Risco | Mitigação |
|---|---|
| Fila offline duplicar tarefas ao reconectar | O sync já faz *upsert por id*; a fila reusa o id local, nunca gera um novo no envio |
| `system-ui` variar entre Android e iOS | Aceito — a variação é menor que o custo de uma fonte que o offline não carrega |
| Som novo soar intrusivo em uso real | Interruptor de três estados junto com qualquer paleta sonora nova |
| Animação de entrada mascarar latência da IA | Coreografia limitada a ~600 ms — além disso é a interface mentindo sobre a espera |
| Ping externo do `/health` falhar e o Render dormir | Monitorar; sono de 15 min transforma qualquer espera em ~30-50s de cold start |

---

### 6. Histórico de sprints

> Escrito para ser entendido por quem não é da área técnica: termos técnicos foram
> mantidos, mas explicados.

#### A história em um parágrafo

O MenteLeve nasceu como um protótipo para provar que a ideia funcionava. Deu certo —
mas nasceu com atalhos. Os meses seguintes foram gastos trocando cada atalho por algo
sólido: o banco de dados que perdia tudo virou um banco de verdade; o login que
confiava em qualquer um virou login com senha; a assistente que só conversava passou
a agir; o conteúdo das usuárias, legível para qualquer um com acesso ao banco, passou
a ser criptografado; e as chamadas de IA, que podiam travar o servidor inteiro,
passaram a ser assíncronas e protegidas contra falha do provedor.

#### Série A — O MVP em 3 dias *(histórico, instruções técnicas obsoletas)*

**MVP:** a menor versão do app que já dá para colocar na mão de alguém e aprender
com o uso. O objetivo era provar uma coisa só — que a IA transformando uma frase
solta ("festa do Léo") numa lista de tarefas realmente encanta.

| Dia | O que foi feito |
|---|---|
| 1 — O Cérebro | O servidor: onde os dados ficam e onde a IA é consultada |
| 2 — O Corpo | As telas que a usuária vê, conversando com o servidor do dia 1 |
| 3 — A Alma | Boas-vindas, animações, e as telas "de vitrine" (Conexões e Paywall) |

**Atalhos assumidos — e por que foram trocados depois:**

| Atalho do MVP | Problema | Virou |
|---|---|---|
| Banco SQLite em disco comum | Os dados sumiam a cada atualização do app | PostgreSQL no Supabase |
| Hospedagem no GitHub Pages | Limitado para o que o app precisava | Vercel |
| Login guardando só o e-mail no navegador | Não havia senha nem verificação | Login com senha e JWT |

Fachadas criadas de propósito no dia 3 — **Conexões** e **Paywall**: visual pronto,
botões só mostram um aviso, para medir interesse antes de construir de verdade.

#### Série B — Migração para a nuvem *(27/08/2026, concluída)*

**O problema:** o banco era um arquivo no disco do Render. No plano gratuito esse
espaço é temporário — toda tarefa cadastrada sumia a cada nova versão do app.

**A solução:** o banco passou a morar no Supabase (PostgreSQL gerenciado).

1. **Preparar o banco** — schema traduzido de SQLite para Postgres, salvo em
   [`supabase_schema.sql`](../Backend/supabase_schema.sql).
2. **Conectar o app** — troca do driver (`psycopg`), testes de CRUD direto no
   Supabase. Bug encontrado: exclusão de tarefa-mãe tentava apagar as subtarefas
   duas vezes (SQLite não fazia cascade sozinho; Postgres faz). Corrigido fazendo o
   SQLite se comportar igual ao Postgres.
3. **Colocar no ar** — frontend na Vercel, CORS ajustado, fluxo testado ponta a
   ponta. Armadilha que custou tempo: a *Direct connection* do Supabase só funciona
   em IPv6 (o Render não tem) — é preciso usar o **Session pooler**.

Decisões desta série: **backend permanece no Render** (ping externo a cada 10 min
em vez de trocar de host); **RLS do Supabase não é usado** — não adiantaria, porque
só o backend fala com o banco, com a role `postgres`, que ignora RLS.

#### Série C — Evolução do produto (Sprints 1–5) *(27–28/08/2026, concluída)*

**Sprint 1 — Segurança e autenticação.** Antes, o app mandava um número
(`X-User-Id`) e o servidor confiava — qualquer um podia trocar por `1` e ler dados
de outra usuária. Virou: senha com **bcrypt**, crachá **JWT** válido por 30 dias,
sessão expirada volta ao login sozinha. Calendário menstrual confirmado 100% local.
Falha anotada, não corrigida ainda: qualquer usuária podia se conceder Premium
sozinha (corrigido na Sprint 6, ver Série D).

**Sprint 2 — Tarefas melhores e a Bruna agindo.**
*Datas:* o app guardava a data como texto ("Amanhã") e reinterpretava todo dia — a
tarefa "andava" um dia para frente, sempre no dia seguinte, nunca atrasava. Corrigido
guardando data e horário estruturados; o texto amigável é derivado só na exibição.
*Bruna:* passou a **criar e concluir tarefas de verdade** via function calling. Ela
nunca escolhe um id — diz o título e o servidor casa contra as tarefas da própria
usuária; com mais de uma parecida, pergunta em vez de escolher. Três bugs
pré-existentes corrigidos no caminho: a Bruna travava após ~20 mensagens (histórico
grande demais), sincronizar apagava tarefas offline, e a conversa sobrevivia ao
logout num aparelho compartilhado. Groq entrou como reserva do Gemini (cota
gratuita de ~20 req/min estourava fácil, e a recusa 429 era engolida em silêncio).

**Sprint 3 — Responsividade e imagens.** Tablets e celulares deitados esticavam o
conteúdo de ponta a ponta (o limite de largura só existia para desktop). Corrigido
só no CSS, nenhuma view mudou. Imagens otimizadas: 1,2 MB → ~125 KB de precache
(WebP + redimensionamento ao uso real). "Padronizar cores" se revelou desnecessário
— já estavam certas.

**Sprint 4 — Som e controle de qualidade.** Sons sintetizados via Web Audio API
(zero byte, zero licença, zero 404 offline) para conclusão de tarefa, resposta da
Bruna e toques principais, com interruptor no Perfil. Três defeitos sérios
encontrados e corrigidos no Service Worker: um único caminho errado na lista de
cache derrubava o offline inteiro sem aviso; respostas de erro (404/5xx) eram
cacheadas e servidas offline como se fossem válidas; e um `catch` quebrado travava
o app ao pedir um arquivo não cacheado sem internet.

**Sprint 5 — Criptografia do conteúdo em repouso.** Fora do plano original — nasceu
de uma pergunta em revisão de segurança. O isolamento entre contas já existia, mas só
para quem entrava pela API; dentro do banco tudo era texto puro. Decisão: cifrar no
servidor (AES-256-GCM), não ponta a ponta — criptografia ponta a ponta mataria a
Bruna (o servidor precisa ler os títulos) e tornaria esquecer a senha uma perda
permanente. `tasks.title` e `users.name` cifrados; e-mail, data, categoria e status
continuam legíveis (sustentam login e calendário). Bug que a própria mudança teria
causado: a checagem de tarefa duplicada comparava título via SQL, o que pararia de
funcionar em silêncio contra ciphertext — corrigido movendo a comparação para Python.

#### Série D — Fundação, percepção e presença (Sprints 6–8) *(31/08/2026, concluída)*

**Sprint 6 — Fundação: "nada se perde".**
- Fechada a escalada de privilégio do Premium: `POST /auth/me/premium?is_premium=`
  deixou de existir; ativar virou `POST /auth/me/premium/simulate` (fechável por
  `SIMULATED_CHECKOUT`), cancelar é sempre permitido.
- **Fila de escrita offline → online**: tarefa criada sem rede não se perdia mais.
  Reenvio no boot e no evento `online`; ao subir uma criação, o id local é trocado
  pelo id do servidor em toda parte que o referencia — é isso que impede duplicatas.
- Rate limit em `/auth/login`: janela deslizante em memória, por e-mail (8/15min) e
  por IP (30/15min), contando só falhas.
- Fontes: corpo passou a `system-ui` (sem requisição render-blocking), Playfair só
  nos títulos, com fallback coerente offline.

**Sprint 7 — Percepção: "o app responde".**
- Skeleton de carregamento na Home (evita "sua mente está limpa" para quem só ainda
  não sincronizou) e estado vazio com ação real.
- Revelação escalonada das subtarefas sugeridas pela Bruna (`.reveal`, animação por
  índice) — só os itens novos animam.
- Ícones reprocessados para WebP: `icon-512` 289 KB → 14 KB.
- Medição corrigiu a própria documentação: o precache não era ~125 KB como se dizia
  desde a Sprint 3 — medido de fato, **264 KB em disco, ~149 KB transferidos**.

**Sprint 8 — Presença: "o app tem vida".**
- Ilustração do onboarding deixou de ser estática: entra com fade+subida, respira em
  ciclo de 6s, e reage ao arraste do carrossel com parallax — sem nenhum asset novo.
- Paleta sonora completa: `playCycle` (registro do ciclo menstrual), `playUndo`
  (inverso de `playComplete` — simetria comunica reversão), `playError`.
- Interruptor de som evoluiu de liga/desliga para três níveis (Todos os sons / Só
  conclusões / Silencioso) — quem achava o chat intrusivo não perdia mais a
  recompensa da conclusão junto.
- Confirmação visual quando a Bruna age de verdade: avatar e logotipo brilham
  brevemente.
- Bug encontrado pelo próprio teste: a migração do interruptor antigo checava o
  campo no objeto já mesclado com o padrão, onde ele sempre existe — nunca rodava de
  verdade. Corrigido para checar o objeto cru do `localStorage`.

**Depois da Série D:** revisão de arquitetura (01/09/2026) identificou que chamadas
de IA bloqueantes podiam esgotar o pool de threads do backend sob falha do provedor.
`ai.py` migrou para `httpx` assíncrono com um circuit breaker no Gemini (ver
[seção 2](#2-estado-atual-do-produto)) — verificado ponta a ponta contra os
provedores reais.

#### O que essas sprints ensinaram

1. **O problema quase nunca era o descrito.** "Melhorar a leitura de datas pela IA"
   era, na verdade, a data estar guardada como texto. "Padronizar as cores" não
   precisava de nada. "Adicionar som" descobriu que o som já existia — faltava
   **desligar**.
2. **Cada sprint desenterrou defeitos antigos.** A Bruna travando após 20 mensagens,
   tarefas offline apagadas, o modo offline quebrado — todos já estavam lá antes da
   sprint que os encontrou.
3. **Os defeitos mais perigosos foram os silenciosos.** Nenhum dos piores problemas
   mostrava mensagem de erro: a IA recusando pedidos sem avisar, o offline falhando
   sem sinal, a proteção contra duplicatas que teria parado de funcionar sem
   ninguém notar. Um erro visível é um erro fácil.
4. **O que ficou de fora está anotado com o motivo** — recorrência de tarefas, login
   social, recuperação de senha. Some da versão, não da documentação.

---

### 7. Ideias futuras / backlog de produto

Ideias registradas mas não implementadas — mantidas aqui para não se perderem nem
voltarem à pauta sem contexto do porquê ainda não existem.

#### Recorrência de tarefas ("governança de ciclos")

Muitas tarefas da carga mental são ciclos repetitivos não documentados (compras de
consumo contínuo, contas mensais). Ideia original: a IA reconhece o padrão e oferece
automatizar —

> Usuária cria "Comprar fraldas e leite" → IA sugere: *"Notei que esta é uma compra
> de consumo contínuo. Deseja que eu crie um ciclo automático para te lembrar a cada
> 15 dias?"*

**Status:** a base existe — colunas `is_recurring`/`recurrence_pattern`, IA e Bruna
reconhecem "todo dia", "toda segunda" etc. (ver [`historico_melhorias.md`](#parte-3--histórico-de-melhorias)).
O que continua ideia é a **sugestão proativa** do ciclo pela IA, como no exemplo acima.

#### Animação de abertura (splash)

O "Despertar da MenteLeve" — partículas soltas convergindo e se fundindo (morphing)
no isotipo, uma faísca piscando para sinalizar a IA nos bastidores, transição suave
para o onboarding. **Já implementado** em `isotipo.webp` (partículas convergindo,
`isoForm`, `isoRise`, faísca piscando) — é hoje a referência de qualidade de
animação do app, citada no [método de planejamento](#5-método-de-planejamento-e-restrições)
como padrão a igualar em outras telas.

#### Diretrizes originais de tela confirmadas em produção

Do blueprint original de telas do MVP, os pontos abaixo continuam válidos como
guideline e já estão implementados — registrados aqui só para não se perderem:

- Hit targets (áreas de toque) de no mínimo 44×44px — "fácil de tocar com uma mão
  enquanto segura um filho ou faz compras".
- Estado vazio nunca é uma tela branca: ilustração acolhedora + uma ação clara (ver
  Sprint 7, [Série D](#6-histórico-de-sprints)).
- O "Aha Moment" da IA se anuncia com um ícone de faísca — consistente com a faísca
  da animação de abertura.

---

### 8. Documentos relacionados

Mapa completo em [`indice.md`](#).

- [`contexto_menteleve.md`](#parte-1--contexto-do-produto) — visão de produto, a dor, a
  proposta de valor e o modelo de negócio. Não consolidado aqui de propósito.
- [`historico_melhorias.md`](#parte-3--histórico-de-melhorias) — relatório de testes,
  recorrência, UX Writing e melhorias visuais (V-01 a V-05).
- [`plano_migracao_vida_trabalho.md`](../docs/plano_migracao_vida_trabalho.md) — ampliação
  do app para vida + trabalho.
- [`../README.md`](../README.md) — como rodar localmente, deploy, endpoints.
- [`../Backend/README.md`](../Backend/README.md) — API, IA e criptografia em detalhe.
- [`../Frontend/README.md`](../Frontend/README.md) — PWA, datas, som, offline.

---

## Parte 3 — Histórico de melhorias

## MenteLeve — Melhorias implementadas

> Relatório histórico (21/09/2026). Desde então o **Paywall/Premium foi removido**
> (`paywall.js` não existe mais) — referências a ele abaixo são registro do que era verdade na época.

- **Parte 1 — TA-01, TA-03 e TA-04** (testes, tarefas recorrentes, UX Writing). O TA-02 (recuperação de senha) foi implementado e depois **removido a pedido** — ver o aviso logo abaixo.
- **Parte 2 — V-01 a V-05** (melhorias visuais e de UI/UX): ao final do arquivo.

---

> **Aviso:** a recuperação de senha (TA-02) foi removida a pedido, por completo. As seções abaixo já refletem isso.

### PARTE 1 — TA-01, TA-03 e TA-04

Escopo: suíte de testes, tarefas recorrentes e
UX Writing empático. Tudo foi feito sobre o código real do repositório; onde o prompt e o código
divergiam, a decisão está registrada na seção 3.

---

#### 1. Resumo das mudanças aplicadas

| Item | O que passou a existir |
|---|---|
| **TA-01 Testes** | Backend: 119 testes `pytest` (auth, tarefas, crypto, recorrência, migração). Frontend: 100 testes com o runner nativo do Node (`dates.js`, `store.js`, mensagens de erro, agrupamento da Home). Sem build e sem dependência nova no frontend. |
| **TA-02 Senha** | **Removido a pedido.** Recuperação de senha (rotas, e-mail, telas, token de sessão, testes, variáveis) foi apagada por inteiro; nada dela ficou no código. Login, cadastro e JWT voltaram ao que eram. |
| **TA-03 Recorrência** | `is_recurring` + `recurrence_pattern` (`daily`/`weekly`/`monthly`) no banco, API, IA (`/tasks/smart` e Bruna), `localStorage` e fila offline. Seletor "Repetir" no `taskSheet` e indicador "↻ Todo dia" na Home. |
| **TA-04 UX Writing** | `friendlyError()` distingue conexão, servidor indisponível, autenticação e validação. Fallback da Bruna reescrito (servidor e cliente) com alternativas manuais. Toasts genéricos trocados. |

**Comportamento de conclusão de tarefa recorrente (decisão central):** concluir **não fecha** a
tarefa nem cria uma cópia — o prazo da *mesma* tarefa rola para a próxima ocorrência. Motivo:
o app é local-first. Com "cópia", o aparelho criaria a próxima tarefa e o servidor criaria outra
ao receber a conclusão: duplicata garantida. Rolar o prazo é uma operação sobre uma linha só, e
cliente e servidor calculam o mesmo resultado com a mesma regra. Custo aceito: não há histórico
de "feito ontem".

---

#### 2. Mapeamento de arquivos

#### Criados

| Arquivo | Descrição |
|---|---|
| `Backend/app/recurrence.py` | `next_occurrence`, `detect_recurrence` ("todo dia", "toda segunda", "todo dia 10"…), `first_occurrence`, `clean_pattern`. |
| `Backend/pytest.ini` | `testpaths`, `pythonpath`. |
| `Backend/tests/conftest.py` | Isolamento: SQLite temporário, chaves de teste, IA desligada, trava que aborta se o banco não for o temporário. |
| `Backend/tests/test_auth.py` | Cadastro, login e JWT (13 testes). |
| `Backend/tests/test_tasks.py` | CRUD, limite de 50, `/tasks/smart`, recorrência (37 testes). |
| `Backend/tests/test_crypto.py` | AES-256-GCM (13 testes). |
| `Backend/tests/test_recurrence.py` | Cálculo e detecção de recorrência (54 testes). |
| `Backend/tests/test_migrations.py` | Banco antigo ganha as colunas novas sem perder dados (2 testes). |
| `Frontend/tests/dates.test.mjs`, `store.test.mjs`, `errors.test.mjs` | Testes do frontend. |
| `DOCS_MELHORIAS_IMPLEMENTADAS.md` | Este relatório (hoje Parte 3 de `docs/indice.md`). |

#### Modificados

| Arquivo | Alteração |
|---|---|
| `Backend/app/models.py` | `Task.is_recurring`/`recurrence_pattern`. |
| `Backend/app/database.py` | 2 colunas novas em `_ADDITIVE_COLUMNS` (migração aditiva, idempotente). |
| `Backend/app/schemas.py` | Campos de recorrência + validador de coerência. |
| `Backend/app/crud.py` | `set_task_done` rola o prazo de recorrentes; `update_task` mantém os campos coerentes. |
| `Backend/app/routers/tasks.py` | `/tasks/smart` devolve recorrência (inclusive no fallback sem IA); `PUT /complete?today=`. |
| `Backend/app/routers/ai_chat.py` | `criar_tarefa` aceita `recorrencia`; conclusão recorrente; novo texto de fallback. |
| `Backend/app/ai.py` | Prompt e sanitização com recorrência; tool `criar_tarefa` com `recorrencia`. |
| `Backend/requirements.txt` | `pytest` (o `httpx` já estava). |
| `Backend/supabase_schema.sql`, `Backend/README.md` | Novas colunas de recorrência; seções de recorrência e testes. |
| `Frontend/js/dates.js` | `nextOccurrence`, `detectRecurrence`, `firstOccurrence`, `cleanPattern`, `RECURRENCE_LABELS`. |
| `Frontend/js/api.js` | `NetworkError`/`ApiError`; campos de recorrência; `apiSetDone(id, done, today)`. |
| `Frontend/js/store.js` | Persiste recorrência; `toggleTask` rola o prazo; a fila offline adota a data do servidor. |
| `Frontend/js/ui.js` | `friendlyError()` e ícone `repeat`. |
| `Frontend/js/components/taskSheet.js` | Seletor "Repetir"; recorrente sempre nasce datada. |
| `Frontend/js/views/home.js` | Indicador de recorrência; conclusão de recorrente. |
| `Frontend/js/views/register.js`, `paywall.js`, `profile.js`, `chat.js`, `login.js` | Mensagens de erro novas; alternativa manual no fallback da Bruna. |
| `Frontend/sw.js` | `CACHE` v40 → v41 (força a atualização do código). |
| `Frontend/README.md` | Como rodar os testes. |

#### Removidos

Nenhum.

---

#### 3. Explicação técnica

#### Banco e migração
- **Colunas novas** (`tasks.is_recurring BOOLEAN NOT NULL DEFAULT FALSE`, `tasks.recurrence_pattern VARCHAR(10)`) entram pelo `_ensure_columns` que já existia: roda no boot, é idempotente, e o `DEFAULT` faz as linhas antigas nascerem com valor válido. `supabase_schema.sql` traz o equivalente para rodar à mão.
- `EncryptedText`, `crypto.py`, as chaves do `.env` e o `styles.css` **não foram tocados**.

#### Recorrência
- **Regra** (`nextOccurrence`, idêntica em Python e JS): primeira data estritamente depois de *hoje* e do prazo atual. Em dia/adiantada → prazo + 1 ciclo; atrasada → pula os ciclos perdidos mantendo o dia da semana/mês; sem prazo → conta de hoje. Mensal limita ao último dia do mês (31/jan → 28/fev).
- **Sincronização sem duplicar**: não existe "criar próxima". Offline, o aparelho rola o prazo local e enfileira a conclusão; no `flush`, o servidor aplica a mesma regra (o cliente manda sua data local em `?today=`) e o aparelho **adota a data devolvida**. Caso especial tratado: recorrente concluída *antes* de o `create` subir — o `create` já leva o prazo rolado, então a conclusão **não** é enfileirada (senão rolaria duas vezes). Coberto por testes.
- **IA**: o prompt de `/tasks/smart` pede `is_recurring` e `recurrence_pattern`; `_sanitize` só aceita `daily|weekly|monthly` (a flag é derivada do padrão) e, se o modelo esquecer, a detecção por regra completa. A tool `criar_tarefa` da Bruna ganhou `recorrencia` (enum). Sem IA, o fallback do servidor também detecta — "Tomar vitamina todo dia às 08:00" → `is_recurring=true`, `daily` sem nenhuma chave configurada.
- **Contrato do `/tasks/smart`**: a rota **não persiste** (é assim desde antes; o cliente cria via `POST /tasks`). Por isso o critério "gerar uma tarefa com `is_recurring=True`" foi atendido como: a resposta traz os campos e o cliente os repassa ao criar. Verificado ponta a ponta (seção 4).
- `TaskBase` valida: padrão sem flag liga a flag; flag sem padrão → 422.

#### UX Writing
- `friendlyError(err, ctx)` devolve **texto fixo** por tipo (conexão / servidor 5xx / 401 / 429 com minutos / 400-422 / genérico) — nunca repassa o `detail` do servidor, que iria para o `innerHTML` do toast.
- Bruna: o `_FALLBACK` do servidor agora tranquiliza ("nada se perdeu") e aponta o `+` e a Home. No cliente, se a IA não respondeu e a usuária pediu uma ação ("anota…", "marca como feita…"), a resposta acrescenta que **nada foi feito** e como fazer à mão — antes, a resposta carinhosa parecia confirmação. A conversa nunca é apagada e a lista de tarefas segue utilizável.

---

#### 4. Testes realizados e resultados

| Verificação | Comando / método | Resultado |
|---|---|---|
| Backend | `cd Backend; .venv\Scripts\python -m pytest` | **119 passed** |
| Frontend | `node --test "Frontend/tests/*.test.mjs"` | **100 pass, 0 fail** |
| Regressão no navegador (após a remoção do TA-02) | Chrome headless + backend com SQLite temporário: os 45 checks da Parte 2 (login, Home, Agenda, Chat, Conexões, Paywall) | **45/45**; `POST /auth/forgot-password` responde **404** |

Antes da remoção do TA-02, um E2E de 31 verificações exercitou a recorrência de ponta a ponta: criar "Tomar vitamina todo dia às 08:00" (servidor persistiu `is_recurring=true`, `daily`, `08:00`; `localStorage` também), indicador "↻ Todo dia", concluir → **1 tarefa só**, `done=false`, prazo 21/09 → 22/09 com aparelho e servidor iguais, e abertura **offline** pelo cache do SW. Os passos do fluxo de senha foram descartados junto com a funcionalidade. O script é descartável e não está no repositório.

**Precache:** ver a Parte 2 (o `recover.js` que pesava no precache não existe mais).

**Não executado / não verificável neste ambiente**
- **Postgres/Supabase**: migrações e testes rodaram só em SQLite. O DDL usado é portável (`BOOLEAN NOT NULL DEFAULT FALSE`) e o SQL equivalente está em `supabase_schema.sql`, mas não foi executado contra um Postgres.
- **Gemini/Groq reais**: nenhuma chamada. A resposta do modelo foi simulada; a rede de segurança por regra cobre o caso de ele não seguir o novo formato, mas o prompt novo não foi validado contra saídas reais.
- Só Chrome; nada em iOS/Safari ou em aparelho físico.

---

#### 5. Melhorias não implementadas / limitações

1. **Reenvio após resposta perdida**: se o servidor aplicar a conclusão de uma recorrente mas a resposta se perder, o reenvio da fila rola o prazo uma segunda vez. Janela pequena; mitigação exigiria um id de operação idempotente.
2. **Mensal e fim de mês**: 31/jan → 28/fev, e a partir daí o "dia âncora" passa a ser 28 (não volta ao 31).
3. **Subtarefas de recorrente** (as sugeridas pela IA) não são reabertas nem reagendadas quando a mãe rola.
4. **Detecção offline (JS) × servidor (Python)**: JS reconhece um subconjunto ("toda semana/manhã/segunda", "todo dia 10", "todo mês"). Para "toda segunda" dita numa segunda-feira, o JS marca a *próxima* segunda; o Python marca hoje.
5. **Não existe edição de tarefa na interface** — então a recorrência só se define ao criar. `PATCH /tasks/{id}` já aceita os campos.
6. **Precache**: a folga apertada da primeira versão foi resolvida na Parte 2 (tirou `mulher-onboard.webp` do precache; ~105 KB).
7. **`Frontend/tests/` é publicado pela Vercel** junto com o site (inofensivo, mas público). Um `.vercelignore` resolveria; não foi criado.
8. Achados **preexistentes**, sem alteração: (a) `resolveDue('Esta semana')` ancora no **sábado** (`6 - getDay()`), embora o comentário diga domingo — o teste documenta o comportamento real; (b) `requirements.txt` limita `cryptography<47`, mas o venv local tem 50.0.1 (os testes rodaram com ela).

---

#### 6. Configurações necessárias

Nenhuma variável de ambiente nova é necessária. (As de e-mail e de recuperação de senha existiram enquanto o TA-02 esteve no código e foram removidas com ele.)

**Deploy:**
- Suba o **backend antes** do frontend. Ordem inversa é tolerada (o servidor antigo ignora os campos novos), mas a recorrência só persiste com o backend novo.
- As colunas são criadas sozinhas no boot. Opcionalmente rode os `alter table … if not exists` novos de `supabase_schema.sql` no SQL Editor do Supabase antes do deploy (mais previsível que o boot).
- O Service Worker vai para `menteleve-v42` (Parte 2); quem já usa o app recebe a versão nova e recarrega uma vez.

**Rodar os testes:**
```
cd Backend && pip install -r requirements.txt && pytest
node --test "Frontend/tests/*.test.mjs"        # na raiz do projeto, Node >= 18
```


---

### PARTE 2 — V-01 a V-05 (melhorias visuais)

Só frontend. Nenhuma alteração em `store.js`, `sound.js` nem no backend.

#### 1. Resumo das alterações

| Item | O que mudou |
|---|---|
| **V-01 Chunking** | A Home agrupa as tarefas em accordions: **Hoje**, **Rotinas Cíclicas**, **Mais Tarde / Próximos Dias** (+ **Concluídas**, recolhida). Badge `#ffccd5`/`#590d22`, transição de 300 ms, funciona por clique, toque e teclado. |
| **V-02 Skeleton** | Classe `.skeleton-pulse` (pulso `#fff0f3` ↔ `#ffccd5`). Home: 3 cartões com as medidas do cartão real. Chat: balão-esqueleto com 3 barras enquanto a Bruna processa. |
| **V-03 Botões** | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-danger`, com hover, foco, `:active` (scale .98), desabilitado e carregando. Excluir agora **pede confirmação**. |
| **V-04 Toque/acessibilidade** | Alvos ≥ 44 px em toda a interface, foco visível global, exclusão sempre visível (sem hover), textos-link em cor legível. |
| **V-05 Vazios e navegação** | Estado vazio acolhedor na Home e nas categorias; estado próprio para "sem conexão"; estado vazio em Conexões; item ativo em pílula `#ffccd5` na bottom bar e na sidebar. |

#### 2. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `Frontend/css/styles.css` | `.skeleton-pulse`/`.skeleton-wrap` (troca a faixa de luz antiga); `.acc-*` (accordion); `.btn*`; foco global; áreas de toque `::after`; `.nav-pill`. Removido o CSS do `.typing-dot` e do `.skeleton` antigo (ficaram sem uso). |
| `Frontend/js/views/home.js` | `sectionOf`/`groupTasks` (exportadas), accordions, esqueleto, estados vazios, exclusão com confirmação, alvos de 44 px, `aposSaida()`. |
| `Frontend/js/views/chat.js` | Balão-esqueleto; `try/finally` garante que o esqueleto saia mesmo em erro. |
| `Frontend/js/ui.js` | `confirmDialog()`; pílula na bottom bar e na sidebar; botão de senha de 44 px. |
| `Frontend/js/components/taskSheet.js`, `views/paywall.js`, `agenda.js`, `connections.js`, `login.js`, `register.js`, `profile.js` | Botões padronizados; `aria-busy` nos estados de carregamento; controles de 44 px; estado vazio em Conexões; `role="switch"`; links em `text-bordeaux-600`. |
| `Frontend/sw.js` | `CACHE` v41 → v42; `mulher-onboard.webp` fora do precache (ver seção 5). |
| `Frontend/tests/home.test.mjs` (novo) | 15 testes do agrupamento. |

#### 3. Detalhes técnicos

- **Agrupamento (`sectionOf`)** — cada tarefa cai em **uma só** seção, sem tocar nos dados: concluída → *Concluídas*; em aberto com prazo hoje **ou vencido** → *Hoje* (atrasada pede atenção agora); recorrente que não caiu em Hoje → *Rotinas Cíclicas*; o resto (futura ou sem prazo) → *Mais Tarde*. Tarefas antigas só com o rótulo "Hoje" também caem em Hoje. Os filtros por categoria continuam valendo; a ordem original é mantida dentro de cada seção. O prompt pedia três seções; a quarta (**Concluídas**, recolhida por padrão) existe porque a lista antiga mostrava as concluídas no fim e não havia onde colocá-las sem violar "demais tarefas pendentes".
- **Accordion** — `grid-template-rows: 0fr → 1fr` + `opacity`, 300 ms, sem medir altura nem `max-height`. Ao fim do fechamento o painel vira `visibility:hidden` (sai da ordem de tabulação e dos leitores de tela). O gatilho é um `<button aria-expanded aria-controls>` dentro de `<h2>`; o painel é `role="region"`. Aberto, o corte de `overflow` é removido depois da animação (senão as sombras dos cartões e o contorno de foco seriam aparados). O estado aberto/fechado sobrevive aos re-renders.
- **Skeleton** — `.skeleton-wrap` nasce invisível e só aparece após **200 ms**: operação rápida termina antes e nunca pisca. Some no instante em que a lista chega, ou em erro (`isSyncing()` termina mesmo com falha; no chat, `finally`). Barras `aria-hidden`; leitores de tela ouvem "Buscando suas tarefas…" / "Bruna está pensando…" uma vez, por `role="status"`. `prefers-reduced-motion` troca o pulso por um tom fixo.
- **Vazio × falha** — lista vazia com sessão e servidor fora do ar mostra "Sem conexão por enquanto" + *Tentar de novo* (refaz o ping e a sincronização), e **não** "Tudo tranquilo". Com o servidor no ar (ou conta só local) aparece "Tudo tranquilo por aqui. Respire fundo!" (ou "…em Casa…") + *Adicionar tarefa*. Nunca durante o carregamento.
- **Botões** — `.btn` = 44 px mínimo, pílula, transição curta; `:active` encolhe 2% no próprio elemento. Os utilitários do Tailwind continuam vencendo sobre `.btn` (o CDN injeta o `<style>` depois deste CSS).
- **Exclusão** — não havia confirmação nenhuma (hover no desktop e menu de pressão longa apagavam direto). `confirmDialog()` (`role="alertdialog"`, foco inicial em "Manter", Tab preso no diálogo, Esc e toque fora cancelam, foco devolvido) foi adicionado. O texto vem por `textContent`.
- **Áreas de toque** — onde o controle é pequeno por desenho (chips, toggles) o `::after` transparente estende só a área clicável; nas subtarefas o botão de 44 px usa margem negativa para **não crescer a linha**. A lixeira agora é visível sempre (cor `#836169`), com `aria-label` e alvo de 44 px. No calendário, as células têm altura mínima de 44 px (a largura é ~41 px em telas de 390 px).
- **Correção de bug antigo (`prefers-reduced-motion`)** — o CSS desligava a animação de `.lift` (e dos cartões) com `!important`; sem animação o `animationend` **nunca dispara**, e concluir ou excluir uma tarefa não redesenhava a lista. `aposSaida()` executa direto sob movimento reduzido e tem um temporizador de segurança nos demais casos.
- **Navegação** — bottom bar: o ícone ganha um `.nav-pill` (`#ffccd5`, ícone `#590d22`) no item ativo. Sidebar: o ativo passou de rosa cheio para a pílula `#ffccd5` com texto/ícone `#590d22`.

#### 4. Testes e validações

| Verificação | Resultado |
|---|---|
| `node --test "Frontend/tests/*.test.mjs"` | **100 pass, 0 fail** (eram 85; +15 do agrupamento) |
| `pytest` (backend, sem alterações visuais nesta parte) | **119 passed** (após a remoção do TA-02) |
| Navegador real (Chrome headless via DevTools Protocol, backend isolado com SQLite temporário; 390×844 mobile com toque e 1280×800 desktop) | **45/45 verificações** |
| Precache do Service Worker (23 itens) | **105,2 KB em brotli** / 114,7 KB em gzip (limite 150 KB; antes da Parte 2: 149,7 / 158,7) |
| Erros JS no console durante os fluxos | Nenhuma exceção não tratada |

O que as 45 verificações do navegador cobriram: 4 seções na ordem certa com as contagens esperadas (2/1/2/1) e sem tarefa duplicada; badge `rgb(255,204,213)` com texto `rgb(89,13,34)`; accordion fecha por clique, por **Enter/Espaço** e por **toque**, altura anima (182 → ~60 → 0 px), duração 0,3 s, recolhido = `visibility:hidden`, contorno de foco de 3 px; estado aberto sobrevive ao re-render; diálogo de exclusão (foco em "Manter", Esc cancela sem apagar, confirmar apaga; botão destrutivo transparente com texto `#c9184a`); botão primário `#ff4d6d`/branco/sombra/≥44 px; **medição de todos os `button`/`a`/`switch` em Home, Sheet, Agenda, Conexões, Chat e desktop: nenhum abaixo de 44 px** (contando a área transparente); pílula ativa na bottom bar e na sidebar; Conexões com estado vazio e `role="switch"`; Paywall e convite continuam navegando; skeleton do chat (3 barras, `role=status`, some ao responder); skeleton da Home (3 cartões, `aria-busy`, pulso ativo, 74 px de altura como o cartão real, sem "Tudo tranquilo" durante o carregamento); depois de a sincronização falhar, "Sem conexão por enquanto" + *Tentar de novo*; vazio de verdade com container `#fff0f3`, ícone `#ff8fa3`, botão que abre o formulário; movimento reduzido sem transições. Os screenshots foram inspecionados à mão (Home, Agenda, Sheet, Conexões, Chat, vazios, esqueleto, confirmação, desktop).

**Contraste (WCAG, calculado):**

| Par | Razão | AA (4,5:1) |
|---|---|---|
| `#836169` (texto secundário `muted`) sobre `#fff0f3` / branco | 4,90 / 5,41 | ✔ |
| `#c9184a` (destrutivo, e agora links/percentuais) sobre branco / `#fff0f3` | 5,66 / 5,12 | ✔ |
| `#800f2f` (secundário) sobre `#fff0f3` / hover `#ffccd5` | 9,38 / 7,33 | ✔ |
| `#590d22` sobre `#ffccd5` (badge e pílula) | 9,86 | ✔ |
| Foco `#800f2f` sobre `#fff0f3` | 9,38 | ✔ |
| **Branco sobre `#ff4d6d` (botão primário)** | **3,21** | ✘ (só passa como texto grande) |
| Branco sobre `#ff758f` (hover do primário) | 2,56 | ✘ |
| `#ff4d6d` como texto sobre `#fff0f3` (uso antigo de `text-accent`) | 2,91 | ✘ → trocado por `#c9184a` |

#### 5. Pendências e limitações

1. **Contraste do botão primário** — a cor (`#ff4d6d`, texto branco) foi exigida pela especificação e dá **3,21:1**, abaixo de 4,5:1 para texto normal (o rótulo tem 16 px semibold, que não conta como "grande"). Não alterei a cor; o hover (`#ff758f`) é ainda mais baixo (2,56:1). Alternativas: texto `#590d22` sobre `#ff4d6d` (4,34:1, ainda curto) ou escurecer o fundo para algo próximo de `#d6284a`.
2. **Precache** — para caber nos 150 KB tirei `mulher-onboard.webp` (48 KB, só o 1º slide do onboarding) do `ASSETS`. Ele passa a ser guardado pelo cache de runtime na primeira exibição; só há perda para quem instala o app e fica offline **antes** de ver o onboarding. Sem essa retirada o precache estouraria (149,7 KB antes desta parte, com 0,3 KB de folga).
3. **Fonte** — o prompt cita Fraunces, mas o projeto usa **Playfair Display** (títulos) e a fonte do sistema (corpo), com decisão documentada no `index.html`. Mantive. Também não existe `text-wine-soft`: o token equivalente é `muted` (`#836169`, 4,90:1), que já cumpre o AA.
4. **Agenda** — a lógica (filtros, ordenação, dia selecionado) não foi tocada; só os alvos de toque e o título do mês, que agora quebra em duas linhas em vez de truncar ("Setembr…"). O agrupamento em accordions vale só para a Home.
5. **Calendário** — as células têm ~41 × 44 px em 390 px de largura (a grade de 7 colunas não comporta 44 px de largura sem mudar o layout).
6. **Botões não convertidos** — os chips de nível de som do Perfil e o botão de enviar do chat mantêm o estilo antigo (já ≥ 44 px). O *sheet* de nova tarefa não tem botão secundário "Cancelar" (fecha pelo toque fora), como antes.
7. **Não verificado** — nenhum leitor de tela real (NVDA/VoiceOver), nenhum aparelho físico nem Safari/Firefox (só Chrome). `grid-template-rows` animável exige Safari ≥ 16 / Chrome ≥ 107; em navegador mais antigo o accordion abre e fecha sem animar. O desempenho em aparelho fraco não foi medido: as animações são só de `opacity`/`grid-template-rows`/`background-color` em CSS.
8. O script de verificação no navegador é descartável e **não** está no repositório.

---

## Parte 4 — README do projeto (cópia)

## 🧠 MenteLeve

> A sua mente não foi feita para guardar tudo.

**MenteLeve** é uma agenda inteligente para **profissionais do mercado de trabalho** — um "Segundo Cérebro" que reúne, num só lugar, as tarefas do trabalho (reuniões, entregas, prazos, estudos, carreira) e da vida pessoal (casa, saúde, família, finanças). Ele organiza a rotina sem atrito, com **Inteligência Artificial** que antecipa os passos invisíveis de cada compromisso (o *Aha Moment*).

> O app nasceu voltado a mulheres e mães e foi ampliado para profissionais em geral (Fases 1 a 5 do [plano de migração](../docs/plano_migracao_vida_trabalho.md)). Falta a recorrência avançada, as visões diária e semanal e as integrações com calendários.

🔗 **App (PWA):** https://mente-leve-teal.vercel.app
🔗 **API:** https://menteleve.onrender.com · [`/docs`](https://menteleve.onrender.com/docs)

---

### 🎓 Sobre o projeto

Desenvolvido por alunos do curso de **Gestão em Tecnologia da Informação** da
**Universidade Cruzeiro do Sul**, como parte da disciplina **Itinerário
Extensionista 2**, sob orientação do professor **Valter de Sales Santana**.

O projeto se alinha a dois Objetivos de Desenvolvimento Sustentável (ODS) da ONU:

- **ODS 3 — Saúde e Bem-Estar:** o app existe para reduzir a sobrecarga mental e o
  risco de **burnout** de quem precisa conciliar as demandas do trabalho com as da
  vida pessoal — prazos, reuniões e metas somados às tarefas domésticas e familiares.
- **ODS 9 — Indústria, Inovação e Infraestrutura:** aplica IA (Google Gemini),
  arquitetura em nuvem e práticas modernas de engenharia de software (PWA,
  criptografia de dados, autenticação segura) como infraestrutura tecnológica
  a serviço desse problema social.

---

### ✨ Funcionalidades

- **Criação inteligente de tarefas (IA):** escreva em linguagem natural e a IA normaliza o título, extrai **data e horário**, categoria, sugere subtarefas e um **lembrete preventivo**.
- **Subtarefas da IA fixadas** na tarefa-mãe (a sugestão vira filho da tarefa que você criou).
- **Bruna — assistente com IA que age:** organiza a agenda e **cria e conclui tarefas pelo chat** ("marca reunião com o cliente amanhã às 10h", "marca o relatório como feito").
- **Trabalho e Vida no mesmo lugar:** 9 categorias em dois grupos (Trabalho: trabalho, reuniões, carreira, estudos · Vida: casa, família, saúde, finanças, pessoal) e filtro **Tudo / Trabalho / Vida** na Home e na Agenda.
- **Tarefas recorrentes** (diária, semanal, mensal): reunião semanal, relatório do mês, rotinas pessoais.
- **Cor do app personalizável:** 5 temas (Bordeaux Pink, Oceano, Floresta, Grafite, Lavanda), escolhidos no Perfil.
- **Agenda em calendário mensal** navegável, com as tarefas distribuídas por data.
- **Categorias, prioridade, data e horário** por tarefa; micro-interações de recompensa ao concluir.
- **Lembretes por notificação push** (opt-in) antes do horário da tarefa.
- **Rede de apoio** (compartilhar tarefas com família ou equipe) — app 100% gratuito, sem limite de tarefas nem plano pago.
- **🌸 Calendário menstrual** (módulo opcional, desligado por padrão, ativado no Perfil; 100% privado/local): fases do ciclo, período fértil e previsão.
- **PWA instalável** e com suporte offline (Service Worker) — 264 KB de precache em
  disco, ~149 KB transferidos (o gzip do servidor comprime os textos; as imagens já
  chegam comprimidas).
- **Conteúdo criptografado no banco** (AES-256-GCM): o título das tarefas e o nome do usuário são ilegíveis para quem acessa o banco por fora da API.

---

### 🛠️ Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | HTML + CSS + **JavaScript Vanilla (ES Modules)** + **Tailwind (CDN)** · PWA (manifest + Service Worker) |
| **Backend** | **FastAPI** + **SQLAlchemy 2.0** + **PostgreSQL (Supabase)** · Pydantic v2 · Uvicorn |
| **IA** | **Google AI Studio / Gemini** (`gemini-2.5-flash`) via REST |
| **Deploy** | Frontend: **Vercel** · Backend: **Render** · Banco: **Supabase** |

Design System: **Bordeaux Pink** (regra 60:30:10) — fundo `#fff0f3`, estrutura `#590d22`, destaque `#ff4d6d`.

---

### 📁 Estrutura do projeto

```
MenteLeve/
├── Frontend/                 # PWA (publicado na Vercel)
│   ├── index.html            # shell + config do Tailwind
│   ├── manifest.json · sw.js # PWA (instalação + cache offline)
│   ├── css/styles.css        # Design System + layout responsivo + animações
│   ├── assets/               # logo (SVG) + ícones do PWA (PNG/WebP)
│   └── js/
│       ├── app.js            # bootstrap + mini-router
│       ├── store.js          # estado local (localStorage) + sync
│       ├── categories.js     # categorias Trabalho/Vida + filtro de grupo
│       ├── theme.js          # temas de cor
│       ├── api.js            # cliente REST (JWT) + heurística de fallback
│       ├── dates.js          # prazo estruturado (resolução + exibição)
│       ├── sound.js          # feedback sonoro sintetizado (Web Audio)
│       ├── ui.js             # helpers, ícones, navegação
│       ├── components/       # taskSheet (nova tarefa + Aha Moment)
│       └── views/            # onboarding, login, register, home, agenda, chat (Bruna), connections, profile
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
└── docs/                     # documentação completa (docs/indice.md) + plano de migração
```

---

### 🚀 Como rodar localmente

#### Pré-requisitos
- **Python 3.12** (recomendado; veja a nota sobre 3.14 abaixo)
- Um navegador moderno

#### 1) Backend (API)
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

#### 2) Frontend (PWA)
ES Modules e Service Worker exigem HTTP (não abra via `file://`):
```bash
cd Frontend
python -m http.server 5500
```
Acesse `http://localhost:5500`. O `API_BASE` detecta automaticamente o ambiente (localhost em dev, Render em produção).

> 💡 **Nota Python 3.14:** as dependências estão fixadas em versões com *wheels* para cp314. Para produção/Render, o `runtime.txt` fixa Python 3.12.8.

---

### 🤖 Configuração da IA

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

Detalhes da troca entre provedores em [`Backend/README.md`](../Backend/README.md).

---

### 🔌 Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Ping (status da API) |
| `POST` | `/auth/register` · `/auth/login` | Cadastro / login (e-mail + senha) — devolvem o token |
| `GET` | `/tasks` · `POST` `/tasks` | Listar / criar tarefa |
| `POST` | `/tasks/smart` | Analisa texto livre com IA (título, data, horário, subtarefas, sugestão) |
| `PUT` | `/tasks/{id}/complete` · `/uncomplete` | Concluir / reabrir |
| `DELETE` | `/tasks/{id}` | Excluir (remove subtarefas) |
| `POST` | `/ai/chat` | Conversa com a **Bruna** — pode criar/concluir tarefas (function calling) |
| `GET` | `/push/public-key` · `POST` `/push/subscribe` · `/push/unsubscribe` | Lembrete de tarefa por notificação push (opt-in, no Perfil) |
| `POST` | `/push/scan` | Varredura de tarefas prestes a vencer — chamada por cron externo, não pelo usuário (requer `X-Scan-Secret`) |

Autenticação: cadastro/login por e-mail + senha (hash **bcrypt**); o backend devolve um **token JWT** que o frontend envia no header **`Authorization: Bearer <token>`**. Sem limite de tarefas — app 100% gratuito.

---

### 🔐 Segurança

| Camada | Como está |
|---|---|
| **Rotas** | Toda rota de dados exige JWT válido; além do login, há checagem de **posse** por tarefa (responde `404`, para não confirmar que a tarefa existe) |
| **Senhas** | **bcrypt** com salt por senha — hash de mão única, a senha nunca é gravada nem registrada em log |
| **Conteúdo no banco** | **AES-256-GCM** no título das tarefas e no nome do usuário (ver [`Backend/app/crypto.py`](../Backend/app/crypto.py)). Um dump do Postgres não revela nada sem a `ENCRYPTION_KEY`, que vive só no ambiente do backend |
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

### ☁️ Deploy

#### Banco → Supabase (Postgres)
- Schema pronto em [`Backend/supabase_schema.sql`](../Backend/supabase_schema.sql) (cole no SQL Editor do projeto).
- Use a connection string do **"Session pooler"** (não a "Direct connection" — essa é IPv6-only e falha em redes/hosts IPv4, incluindo o Render). Painel do Supabase → **Connect** → **Connection string** → **Session pooler**.
- `DATABASE_URL` no formato `postgresql+psycopg://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres`.

#### Backend → Render
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

#### Frontend → Vercel
- **Root Directory:** `Frontend`
- **Framework Preset:** Other (sem build — HTML/JS puro).
- Deploy automático a cada push em `main` (via integração Vercel ↔ GitHub).

Detalhes completos da migração (SQLite→Postgres, GitHub Pages→Vercel) em [`docs/indice.md`](#série-b--migração-para-a-nuvem-27082026-concluída).

---

### 🗺️ Roadmap

**Concluído:**
- Migração para Supabase + Vercel
- Sprint 1: autenticação real (JWT + senha com bcrypt)
- Sprint 2: prazo estruturado (data/horário) e a **Bruna executando ações** pelo chat
- Sprint 3: responsividade em tablet e imagens otimizadas (precache −90%)
- Sprint 4: feedback sonoro (com opção de silenciar) e correções no Service Worker
- Sprint 5: criptografia do conteúdo em repouso (AES-256-GCM)
- Sprints 6–8: fila de escrita offline → online, rate limit no login, fim da
  escalada de privilégio no Premium, e polimento de percepção/presença
- IA assíncrona (`httpx`) com circuit breaker no Gemini, para não travar o backend
  sob falha do provedor

📍 **[`docs/indice.md`](#)** — documentação completa num arquivo só: contexto
do produto, estado atual, o que é fachada, design system, diretrizes de UX, histórico de
sprints e de melhorias.

**Próximos passos:**
- [ ] **Recuperação de senha** — hoje não há caminho de autoatendimento para quem esquece a senha
- [ ] **Revogação de sessão** — sem forma de invalidar um token antes de expirar (30 dias)
- [ ] OAuth real (Apple / Google) e notificações da rede de apoio
- [ ] CI rodando a suíte de testes (a suíte já existe)
- [ ] Ampliação para vida + trabalho — ver [`docs/plano_migracao_vida_trabalho.md`](../docs/plano_migracao_vida_trabalho.md)

---

### 📄 Licença

Projeto em desenvolvimento. Uso e distribuição a definir pelo autor.

---

<p align="center">Feito com 💗 para deixar a sua mente mais leve.</p>

---

## Parte 5 — README do Backend (cópia)

## MenteLeve — Backend (API)

API REST em **FastAPI + PostgreSQL/Supabase (SQLAlchemy)**: CRUD de tarefas,
autenticação por e-mail + senha (JWT), IA (Gemini com reserva no Groq) e
criptografia do conteúdo em repouso.

### Stack
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + PostgreSQL (Supabase, via driver `psycopg`) — SQLite disponível como fallback local (padrão sem `DATABASE_URL`)
- Pydantic v2
- bcrypt (senhas) · PyJWT (tokens) · cryptography (AES-256-GCM do conteúdo)

### Como rodar (local)

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

### Estrutura

```
Backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, /health, monta routers
│   ├── config.py        # settings via variáveis de ambiente
│   ├── database.py      # engine SQLAlchemy (Postgres/SQLite), sessão, init_db()
│   ├── models.py        # User, Task
│   ├── schemas.py       # Pydantic (entrada/saída)
│   ├── crud.py          # operações de banco
│   ├── security.py      # hash de senha (bcrypt) + tokens JWT
│   ├── crypto.py        # AES-256-GCM do conteúdo em repouso (EncryptedText)
│   ├── ai.py            # Gemini + Groq (analyze, chat, function calling)
│   ├── dependencies.py  # auth via Authorization: Bearer <token>
│   └── routers/
│       ├── auth.py      # /auth/register, /auth/login, /auth/me
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

### Autenticação (JWT)

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

OAuth real (Google/Apple) ainda não está implementado — ver `docs/indice.md`.

> Não há limite de tentativas de login. O custo do bcrypt (~250 ms por tentativa)
> freia força bruta na prática, mas não é uma trava — está na lista de próximos passos.

### Criptografia do conteúdo (em repouso)

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

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Ping (usado pelo frontend) |
| POST | `/auth/register` | Cria conta (e-mail + senha) e devolve o token |
| POST | `/auth/login` | Autentica e devolve o token |
| GET | `/auth/me` | Dados do usuário atual |
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

### Bruna: ações pelo chat

Os prompts (`app/ai.py`: `_SYSTEM` para a análise de tarefas e `_CHAT_SYSTEM` para a Bruna) cobrem trabalho **e** vida pessoal: descrevem cada uma das 9 categorias, dão exemplos de subtarefas de trabalho (reunião → pauta/convite/ata; entrega → revisar/aprovar/enviar) e usam linguagem neutra, sem presumir gênero, profissão nem se a pessoa tem filhos. A Bruna também é instruída a não registrar informações confidenciais de trabalho. O `tests/test_prompts.py` trava essas propriedades.

`POST /ai/chat` usa *function calling* do Gemini. A Bruna pode chamar duas funções:
`criar_tarefa` e `concluir_tarefa`. **Excluir ficou de fora de propósito** — é
destrutivo e a identificação é por texto aproximado.

Pontos de projeto que importam ao mexer aqui (`routers/ai_chat.py`):
- **O modelo nunca informa um id.** Ele passa o título com as palavras da pessoa e o
  servidor casa contra as tarefas **dela** (`_match_tasks`, ignorando acentos/caixa).
  Isso elimina a classe de erro "modelo inventa um id". Com mais de uma candidata,
  devolve `ambiguo` e a Bruna pergunta em vez de escolher.
- **Confirmação composta no servidor** no caminho feliz (1 ida ao modelo, mais rápido
  e sem risco de a IA narrar errado o que fez). A 2ª ida só acontece quando é preciso
  nuance: ambiguidade, tarefa não encontrada, limite do plano.
- **Idempotência:** o timeout do cliente não cancela a requisição, então a pessoa
  podia ver o fallback, repetir o pedido e criar duplicata. `find_recent_duplicate`
  bloqueia isso.
- **Limite gratuito vira resultado de função**, não `HTTPException(402)` — um 402 aqui
  abortaria a resposta e a pessoa perderia a fala da Bruna.

### IA: provedor principal e reserva

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

### Categorias

`app/categories.py` é a fonte única: **Trabalho** (`trabalho`, `reunioes`, `carreira`, `estudos`) e
**Vida** (`casa`, `familia`, `saude`, `financas`, `pessoal`). O frontend espelha em `js/categories.js`.

As categorias antigas (`filhos` → `familia`, `relacionamento` → `pessoal`) continuam aceitas na
entrada e são convertidas pelo schema (`BeforeValidator`) — clientes com cache antigo e filas
offline ainda as enviam. As linhas já gravadas são convertidas no boot por
`database._migrate_categories` (UPDATE idempotente; o equivalente em SQL está no fim de
`supabase_schema.sql`). A resposta da API sempre traz as categorias atuais.

### Tarefas recorrentes

`is_recurring` + `recurrence_pattern` (`daily` | `weekly` | `monthly`). Concluir uma recorrente
**não a fecha**: o prazo rola para a próxima ocorrência (`app/recurrence.py`), sem criar cópia.
`PUT /tasks/{id}/complete?today=AAAA-MM-DD` recebe a data local do usuário.

Dois campos refinam a regra:

- `recurrence_weekdays` (só com `weekly`): dias específicos, `0` = segunda … `6` = domingo
  (padrão do `date.weekday()` do Python; **não** o `getDay()` do JS). Dias úteis = `[0,1,2,3,4]`.
  A próxima ocorrência é o primeiro desses dias depois de hoje e do prazo. No banco vira o
  texto `"0,2,4"` (`models.WeekdayList`).
- `recurrence_until`: último dia da série. Concluir quando não há próxima ocorrência antes
  dele **fecha** a tarefa de vez.

A detecção por texto (`recurrence.resolve`) reconhece "dias úteis", "de segunda a sexta",
"toda segunda e quarta", "até 20/12", "até dezembro". É usada pela IA (quando ela omite ou
erra os campos), pelo fallback sem IA do `/tasks/smart` e pela Bruna (`dias_semana`, `ate`).
`PATCH /tasks/{id}` edita a recorrência depois de criada e mantém os campos coerentes
(desligar limpa tudo; trocar para diário/mensal descarta os dias).

### Testes

```
pip install -r requirements.txt
pytest
```

Usam um SQLite temporário e desligam IA e e-mail — não tocam o `.env` real nem o banco de produção.

### Deploy (Render)
- Build: `pip install -r requirements.txt`
- Start: definido no `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- **Importante:** aponte `DATABASE_URL` para o Postgres do Supabase — use a connection
  string do **"Session pooler"** (IPv4), não a "Direct connection" (IPv6-only, não
  resolve em muitos hosts/redes). Ver [`supabase_schema.sql`](../Backend/supabase_schema.sql) para
  criar as tabelas e [`docs/indice.md`](#) para o histórico completo.
- **Variáveis obrigatórias:** `DATABASE_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`.
  As duas últimas são valores **diferentes**, geradas com
  `python -c "import secrets; print(secrets.token_hex(32))"`.

No boot, `init_db()` aplica micro-migrações: `_ensure_columns()` adiciona colunas novas
e `_widen_columns()` converte para `TEXT` as colunas criptografadas. As duas apenas
registram aviso se falharem — derrubar o boot deixaria a API inteira fora do ar.

### Próximos passos
- OAuth real (Google/Apple).

---

## Parte 6 — README do Frontend (cópia)

## MenteLeve — Frontend (PWA)

App de gestão de carga mental. Frontend em **HTML/CSS/JS Vanilla + Tailwind (CDN)**, sem build, instalável como PWA.

### Como rodar

O app usa ES Modules e Service Worker, então precisa ser servido por HTTP (não abrir o `index.html` direto via `file://`).

```bash
# dentro da pasta Frontend
python -m http.server 5500
```

Depois acesse **http://127.0.0.1:5500** no navegador (ative o modo dispositivo móvel no DevTools para a experiência completa).

`API_BASE` (em `js/api.js`) detecta o ambiente sozinho: `localhost` em dev, Render em produção.

### Estrutura

```
Frontend/
├── index.html              # shell + config do Tailwind (cores Bordeaux Pink)
├── manifest.json           # PWA
├── sw.js                   # service worker (precache + cache offline)
├── assets/                 # ilustrações (WebP) + ícones do PWA (PNG)
├── css/styles.css          # tokens, layout responsivo, animações
└── js/
    ├── app.js              # bootstrap + mini-router (deep-link por hash)
    ├── store.js            # estado + localStorage + sincronização
    ├── api.js              # cliente REST (JWT) + heurística local de fallback
    ├── dates.js            # prazo estruturado: resolução e exibição de datas
    ├── categories.js       # categorias (Trabalho / Vida), mapeamento das antigas, grupo escolhido
    ├── theme.js            # temas de cor: lista, persistência e aplicação
    ├── sound.js            # feedback sonoro sintetizado (Web Audio)
    ├── ui.js               # helpers: DOM, ícones SVG, toast, navbar
    ├── components/
    │   └── taskSheet.js    # Bottom Sheet de nova tarefa + modal "Aha Moment" da IA
    └── views/
        ├── onboarding.js   # carrossel de 3 slides
        ├── login.js        # entrar (e-mail + senha)
        ├── register.js     # criar conta
        ├── home.js         # dashboard "Minha Mente"
        ├── agenda.js       # calendário mensal + ciclo menstrual (local)
        ├── chat.js         # Bruna (IA)
        ├── connections.js  # rede de apoio (estático)
        └── profile.js      # perfil / conta
```

### Autenticação

E-mail + senha, com token **JWT**. O token fica no `localStorage` e vai em
`Authorization: Bearer` a cada chamada. No boot, `store.restoreSession()` revalida o
token em `/auth/me`; se o backend responder **401**, a sessão é limpa e o app volta
para o login (ver `api.onSessionExpired`).

### Datas das tarefas

O prazo é **estruturado**: `dueDate` (`AAAA-MM-DD`) + `dueTime` (`HH:MM`). O texto
amigável ("Hoje", "Amanhã • 10:00") é **derivado na exibição** por `dates.js::formatDue`
— nunca armazenado.

> Guardar o rótulo criava duas fontes de verdade: uma tarefa salva como "Amanhã"
> continuava exibindo "Amanhã" para sempre e **andava um dia no calendário a cada dia
> que passava**, sem nunca ficar atrasada. O campo `due` (texto livre) só permanece
> como fallback de exibição para tarefas criadas antes dessa mudança.

Cuidado ao mexer: `new Date('2026-08-27')` é interpretado como meia-noite **UTC** e
volta um dia no Brasil. Use `dates.js::dateFromKey` / `keyOf`, nunca o construtor direto.

### Modo offline

O app é *local-first*. Sem backend, `store.login()` entra em modo local com tarefas de
demonstração, e `dates.js::resolveDue` resolve as datas no próprio cliente — senão quem
está sem conexão não veria as tarefas no calendário (não existe fila de sincronização).

Ao sincronizar, o store faz **upsert por id** (`store.upsertTasks`), nunca substitui a
lista inteira: isso apagaria tarefas criadas offline e rebaixaria a prioridade, que o
backend não persiste.

### Som

`js/sound.js` **sintetiza** os sons pela Web Audio API — não há arquivos de áudio.
Motivo: o precache do PWA é enxuto (264 KB em disco, ~149 KB transferidos); anexar
`.mp3` andaria para trás. O Perfil oferece três níveis — **Todos os sons /
Só conclusões / Silencioso** — e cada som pertence a uma família (`recompensa` ou
`ambiente`) que o nível libera ou não.
Sintetizar custa zero byte e não pode dar 404 no modo offline.

O `AudioContext` nasce suspenso até um gesto da usuária (política de autoplay), então é
criado preguiçosamente e retomado com `resume()`. **Falha de áudio nunca pode derrubar
a ação que o disparou** — tudo é tolerante a erro.

No nível **Todos os sons** por padrão. A preferência (`soundLevel`) é do **aparelho**,
não da conta: sobrevive ao logout, assim como os dados do ciclo. Estados gravados pela
versão do interruptor booleano migram na leitura — quem tinha desligado fica em
`silencio`.

### Temas de cor

O app tem 5 temas (Bordeaux Pink é o padrão); a escolha fica em **Perfil → Cor do app**.
Cada tema é um bloco `:root[data-theme="..."]` em `css/styles.css` que só redefine os
canais RGB (`--rgb-*`). Tudo deriva deles: os `--color-*` do CSS e as cores do Tailwind
(`index.html`, via `rgb(var(--rgb-x) / <alpha-value>)`, então `bg-accent/15` funciona em
qualquer tema).

- **Não escreva hex no código** — use um token (`var(--color-accent)`, `text-bordeaux-900`…).
  Cor fixa não acompanha o tema. (Exceções: branco e o logotipo do Google.)
- O tema salvo é aplicado por um script no `<head>` do `index.html`, **antes** do primeiro
  render (sem flash). O id vem de `js/theme.js`; a chave é `menteleve.theme`.
- Para criar um tema: acrescente o bloco no CSS e a entrada em `THEMES` (`theme.js`). O
  `tests/theme.test.mjs` confere que os dois batem e que o contraste de texto é ≥ 4,5:1.
- O logotipo e as ilustrações do onboarding acompanham o tema. Só os **ícones do PWA** não
  (são arquivos estáticos; ver "Imagens").

### Repetição de tarefas

`js/dates.js` espelha `Backend/app/recurrence.py`: `nextOccurrence` (com dias específicos e
fim da série), `detectWeekdays`, `detectUntil`, `firstOccurrence` e `recurrenceLabel`. Dias no
padrão do Python (**0 = segunda**); use `weekdayOf(chave)`, nunca `Date.getDay()` direto.
O seletor (`components/recurrencePicker.js`) é o mesmo na criação e na edição; a edição fica
no menu da tarefa (pressão longa / botão direito) e, offline, entra na fila como `update`.

### Categorias

`js/categories.js` é a fonte única: 4 de **Trabalho** (trabalho, reuniões, carreira, estudos)
e 5 de **Vida** (casa, família, saúde, finanças, pessoal). O backend espelha em
`Backend/app/categories.py`. As ids antigas (`filhos` → `familia`, `relacionamento` →
`pessoal`) são convertidas ao carregar o estado local e nas respostas da API.
O filtro **Tudo / Trabalho / Vida** (Home e Agenda) é lembrado em `menteleve.group`.

### Imagens

O **logotipo** é SVG inline (`js/ui.js::logoMark`) e usa as cores do tema ativo; as
ilustrações do onboarding também são feitas só de tokens, sem imagem. Os **ícones do PWA**
(`icon-192`/`icon-512`) são arquivos fixos e **não acompanham o tema** — usam uma versão
neutra em grafite, gerada a partir de `assets/logo.svg`. Se mudar o desenho do logo, mude
os três lugares: `logo.svg`, `logoMark` e a splash do `index.html`.
O `manifest.json` lista o WebP primeiro e mantém o **PNG como fallback** para qualquer
plataforma que não o aceite.

Os **PNG** dos ícones estão **fora do precache** do Service Worker de propósito. O
manifest oferece WebP primeiro (`icon-512.webp`, 14 KB) com o PNG como fallback, e é
o `icon-192.webp` (4 KB) que entra no precache. O PNG de 512 — só o manifest
o usa, na instalação. Ao adicionar um arquivo novo, lembre de incluí-lo em `ASSETS`
(`sw.js`) **e incrementar o `CACHE`**, senão o modo offline fica sem ele.

### Testes

Sem dependências nem build — só o Node (>= 18) da máquina:

```
node --test "Frontend/tests/*.test.mjs"
```

Cobrem `dates.js`, `categories.js`, `theme.js` (inclusive o contraste de cada tema), a persistência/fila offline do `store.js` (com `localStorage` e `fetch`
simulados) e as mensagens de erro. Os casos de recorrência espelham `Backend/tests/test_recurrence.py`.

### Notas

- Login social (Apple/Google) está **desabilitado** com aviso "em breve" — não há OAuth real.
- Conexões tem visual completo, mas o convite de parceiro(a) ainda é simulado.
- O **calendário menstrual é um módulo opcional** (Perfil → Calendário menstrual; desligado
  por padrão) e 100% local (`localStorage`), nunca vai ao backend — e sobrevive à expiração
  da sessão, por não pertencer à conta. Quem já o usava antes do módulo existir continua
  com ele ligado (migração em `store.js::migrar`). Desligar só esconde: os dados ficam.
- Estado persiste em `localStorage` (chave `menteleve.state.v1`).
- No **servidor**, o título das tarefas é criptografado (AES-256-GCM). No **aparelho**
  ele fica em texto puro no `localStorage` — é o que faz o modo offline funcionar. A
  criptografia protege o banco, não o dispositivo de quem já está com a sessão aberta.
  Por isso `store.clearSession()` limpa as tarefas ao sair da conta.
