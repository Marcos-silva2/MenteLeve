# 📚 Documentação — MenteLeve

> Documento único: estado atual, design system, diretrizes de UX e histórico de
> sprints. Consolidado em 01/09/2026 a partir dos documentos que existiam em `docs/`
> — o conteúdo específico de cada sprint foi condensado aqui; os arquivos originais
> foram removidos para não duplicar informação. A visão de produto (o quê e o porquê
> do app) continua em [`contexto_menteleve.md`](contexto_menteleve.md), que não foi
> tocado.

## Índice

1. [Visão geral](#1-visão-geral)
2. [Estado atual do produto](#2-estado-atual-do-produto)
3. [Design system — Bordeaux Pink](#3-design-system--bordeaux-pink)
4. [Diretrizes Mobile × Desktop](#4-diretrizes-mobile--desktop)
5. [Método de planejamento e restrições](#5-método-de-planejamento-e-restrições)
6. [Histórico de sprints](#6-histórico-de-sprints)
7. [Ideias futuras / backlog de produto](#7-ideias-futuras--backlog-de-produto)
8. [Documentos relacionados](#8-documentos-relacionados)

---

## 1. Visão geral

O **MenteLeve** é um app de gestão de carga mental para mulheres e mães — um
"segundo cérebro" que reduz sobrecarga cognitiva com uma assistente de IA (Bruna)
que organiza e antecipa tarefas da rotina. A dor, a proposta de valor e o modelo de
negócio (freemium, limite de 50 tarefas) estão descritos em detalhe em
[`contexto_menteleve.md`](contexto_menteleve.md) — não repetido aqui.

O restante deste documento cobre o que já existe de fato: arquitetura, decisões
técnicas, design system, diretrizes de UX e o histórico de como o produto chegou
ao estado atual.

---

## 2. Estado atual do produto

> Retrato do aplicativo em **31/08/2026**, após a Sprint 8.

### Em uma frase

Aplicativo de gestão de **carga mental** para mulheres e mães, no ar como PWA
instalável, com autenticação real, banco Postgres gerenciado, IA que cria e conclui
tarefas por conversa, e o conteúdo das tarefas criptografado no banco.

### No ar

| | Endereço | Hospedagem |
|---|---|---|
| **App (PWA)** | https://mente-leve-teal.vercel.app | Vercel |
| **API** | https://menteleve.onrender.com · [`/docs`](https://menteleve.onrender.com/docs) | Render |
| **Banco** | Postgres (Session pooler, IPv4) | Supabase |

Custo mensal: **R$ 0** — tudo em plano gratuito.

### O que funciona de verdade

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
- **A2F por e-mail no login** (opcional — ativa sozinha quando `RESEND_API_KEY` está
  configurada): senha correta dispara um código de 6 dígitos por e-mail
  (`POST /auth/login/verify` troca o código pelo token). Sem a chave, o login segue
  exatamente como antes — a A2F nunca é uma trava que pode deixar alguém de fora. Ver
  [`Backend/app/routers/auth.py`](../Backend/app/routers/auth.py),
  [`Backend/app/otp.py`](../Backend/app/otp.py) e
  [`Backend/app/mailer.py`](../Backend/app/mailer.py).

### O que é fachada

Visual completo, ação simulada — proposital, para medir interesse:

- **Rede de apoio** (Conexões): não há convite real nem notificação.
- **Paywall Premium**: a assinatura é simulada, não há cobrança.
- **Login social (Apple/Google)**: botões desabilitados com aviso "em breve".
- Itens do menu do Perfil, exceto o seletor de nível de som, mostram
  "Recurso disponível na versão final".

### Como está construído

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

### Segurança

| Camada | Como está |
|---|---|
| **Rotas** | Toda rota de dados exige JWT. Além do login, há checagem de **posse** por tarefa, respondendo `404` para não confirmar que a tarefa existe |
| **Senhas** | bcrypt com salt por senha; nunca gravada nem registrada em log |
| **Conteúdo no banco** | **AES-256-GCM** em `tasks.title` e `users.name`. Um dump do Postgres mostra `v1:<base64>` |
| **Em trânsito** | HTTPS ponta a ponta |

Legível de propósito: **e-mail** (chave de busca do login, índice UNIQUE), **data**,
**categoria** e **status** — sustentam o calendário e os índices. O banco revela
*quando*, não *o quê*.

#### Limites conhecidos

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

### Variáveis de ambiente (Render)

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
| `RESEND_API_KEY` | não | login sem A2F (segue só com senha, como sempre foi) — gerar em [resend.com](https://resend.com) |
| `RESEND_FROM_EMAIL` | não | usa `onboarding@resend.dev` (só entrega pra própria conta Resend — trocar por domínio verificado em produção) |
| `LOGIN_OTP_TTL_SECONDS` | não | padrão 300s (5 min) de validade do código |

`SECRET_KEY` e `ENCRYPTION_KEY` são valores **diferentes**, gerados com
`python -c "import secrets; print(secrets.token_hex(32))"`.

### Pendências conhecidas

**Segurança / retenção — sem dono ainda**
- Não há fluxo de **recuperação de senha** (self-service). Maior risco de churn silencioso do produto hoje.
- Sem **revogação de sessão** (logout remoto / token comprometido).
- `users.name` da conta `Admin` ainda está em texto puro (anterior à criptografia).
  Converter com `python scripts/encrypt_existing.py --aplicar`.

**Antes de cobrar de verdade**
- `SIMULATED_CHECKOUT` precisa virar `false` no dia em que houver cobrança real —
  a rota de simulação (`POST /auth/me/premium/simulate`) fecha sozinha nesse caso.

**Funcionalidade**
- **Recorrência de tarefas** precisa de coluna própria (foi removida do prompt da IA
  porque o schema não a representava e ela gerava lixo por construção). Ver
  [seção 7](#7-ideias-futuras--backlog-de-produto) para a ideia original.
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
- Não há suíte de testes automatizados nem CI. Maior risco estrutural do backend hoje
  (criptografia, auth e a fila de sync offline dependem só de verificação manual).

### Onde as coisas estão

```
Frontend/js/
├── app.js          bootstrap + mini-router (deep-link por hash)
├── store.js        estado + localStorage + sincronização
├── api.js          cliente REST (JWT) + heurística local de fallback
├── dates.js        prazo estruturado: resolução e exibição
├── sound.js        feedback sonoro sintetizado (Web Audio)
├── push.js         notificação push: permissão, subscribe/unsubscribe
└── views/          onboarding, login, register, home, agenda,
                    chat (Bruna), connections, paywall, profile

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

## 3. Design system — Bordeaux Pink

Identidade visual que combina tons profundos de bordeaux com rosas vibrantes e
neutros suaves. Personalidade: **sofisticada, romântica, moderna, confiante,
elegante, acolhedora.**

### Paleta oficial

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

### Regra 60:30:10

- **60% — Lavender Blush (`#fff0f3`):** fundo principal, telas, containers, modais,
  áreas de leitura. Objetivo: leveza, limpeza, conforto visual.
- **30% — Night Bordeaux (`#590d22`):** navbar, sidebar, cabeçalhos, rodapés, títulos
  principais, superfícies premium. Objetivo: sofisticação, autoridade, identidade.
- **10% — Bubblegum Pink (`#ff4d6d`):** botões CTA, links importantes, indicadores
  ativos, badges, estados de sucesso visual. Objetivo: atrair atenção imediata.

### Hierarquia de texto

| Elemento | Cor |
|---|---|
| Título H1 | `#590d22` |
| Título H2 | `#800f2f` |
| Corpo | `#590d22` |
| Texto secundário | `#a4133c` |
| Texto desabilitado | `#ff8fa3` |

### Botões

**Primary** — fundo `#ff4d6d`, texto `#ffffff`, hover `#ff758f`, pressed `#c9184a`.
**Secondary** — fundo transparente, borda `#800f2f`, texto `#800f2f`, hover `#ffccd5`.
**Ghost** — texto `#a4133c`, hover `#fff0f3`.

### Inputs

- **Normal:** borda `#ffccd5`, fundo `#ffffff`.
- **Focus:** borda `#ff4d6d`, shadow `0 0 0 4px rgba(255,77,109,.15)`.
- **Error:** borda `#c9184a`.

### Cards

- **Padrão:** fundo `#ffffff`, borda `#ffccd5`, shadow `0 8px 24px rgba(89,13,34,.08)`.
- **Destaque:** fundo `#ffb3c1`, borda `#ff758f`.

### Estados do sistema

Success `#ff4d6d` · Warning `#ff8fa3` · Error `#c9184a` · Info `#a4133c`.

### Gradientes recomendados

```css
/* Hero */
linear-gradient(135deg, #590d22 0%, #800f2f 50%, #c9184a 100%)

/* CTA */
linear-gradient(135deg, #ff4d6d 0%, #ff758f 100%)

/* Soft Background */
linear-gradient(180deg, #fff0f3 0%, #ffccd5 100%)
```

### Tokens CSS

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

### Regras de uso

**Faça:** use Lavender Blush como fundo principal · Night Bordeaux para estrutura e
tipografia · Bubblegum Pink apenas para chamar atenção · mantenha contraste alto ·
preserve o 60:30:10 em toda tela.

**Evite:** grandes áreas em Bubblegum Pink · texto longo sobre fundo Bubblegum Pink ·
misturar mais de três tons fortes na mesma tela · usar Rosewood e Bubblegum Pink
simultaneamente em CTAs concorrentes.

A identidade deve transmitir **elegância + romance + sofisticação + modernidade**,
com a distribuição 60/30/10 mantida em todas as telas.

---

## 4. Diretrizes Mobile × Desktop

Estratégia de UX/UI adaptativa para o MenteLeve PWA: mobile é o uso principal,
desktop é acesso complementar. Independente do dispositivo, o app mantém a promessa
de redução de sobrecarga — o princípio orientador é **"spa mental"**: se o desktop
parecer um cockpit de avião, o design falhou na proposta de valor.

### Princípios

- **Densidade:** mantenha o respiro (white space). Desktop é uma versão expandida e
  focada, não um "dashboard financeiro denso".
- **Foco:** a IA é o centro. Onde a usuária estiver, o gatilho da IA deve ser visível.
- **Identidade:** paleta Bordeaux Pink consistente; só estados de erro/sucesso destoam.

### Adaptação por categoria

| Categoria | Mobile (ação/rapidez) | Desktop (visão geral) |
|---|---|---|
| Dashboard | Lista vertical (checklist) | Sidebar (agenda semanal) + lista principal |
| Nova Tarefa (IA) | Bottom Sheet (polegar) | Modal central (teclado/foco) |
| Navegação | Bottom Bar | Sidebar lateral fixa |
| Pop-up da IA | Fullscreen ou 80% do ecrã | Modal central pequeno (pop-over) |
| Paywall | Scroll vertical linear | Card centralizado, colunas lado a lado |
| Interações | Swipe para concluir | Checkbox explícito |

### Diretrizes específicas

- **Criação de tarefas:** mobile prioriza digitar/ditar rápido (usuária na rua ou
  ocupada); desktop pode mostrar o "plano" da IA maior, com edição rápida das
  subtarefas antes de salvar.
- **Agenda:** mobile mostra "Agenda do Dia" (timeline vertical, foco no *agora*);
  desktop aproveita a largura para a visão semanal, evitando a surpresa do "amanhã".
- **Paywall:** deve permanecer quase idêntico nos dois — o apelo emocional funciona
  melhor em tela cheia, sem distração.
- **Gesto vs. mouse:** swipe no mobile; ícones de ação visíveis só no hover (tons de
  Cherry Rose, discretos) no desktop.
- **Espaço extra no desktop** é para planejamento de longo prazo, não para mais botões.
- **FAB "Adicionar"** ancorado no canto inferior direito em qualquer tamanho de tela —
  preserva a memória muscular de quem alterna entre celular e PC.

---

## 5. Método de planejamento e restrições

### Restrições invioláveis

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

### Instrumentos de priorização

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

### Definition of Done

Um item só está pronto quando **todos** valem:

1. Funciona offline (ou degrada em silêncio, sem erro visível).
2. Respeita `prefers-reduced-motion`.
3. Se emite som, respeita o interruptor do Perfil.
4. Não aumenta o precache em mais de 5 KB sem decisão explícita registrada.
5. Testado em viewport de 360 px e em desktop.
6. Sem dependência nova de CDN.

### Cadência

Sprints de **2 semanas**. Fundação técnica (segurança, dados) é planejada em
cascata — escopo fechado, sem replanejar no meio, porque erro ali custa dado de
usuária. Camada de experiência (design, som, animação) é iterativa: entrega,
observa, ajusta.

### `Won't` — decidido e documentado

| Proposta | Motivo |
|---|---|
| **GSAP** | Dezenas de KB via CDN para coreografia que `animation-delay` já entrega. Contradiz o precache enxuto |
| **AOS (Animate On Scroll)** | Revelar tarefas conforme a rolagem adiciona ruído a uma lista que a usuária quer ler de uma vez |
| **Swup** | O mini-router por hash com `viewEnter` já elimina o flash branco; Swup pressupõe navegação multi-página |
| **Lottie** | ~250 KB de runtime para substituir ícones vetoriais que já são SVG inline |
| **Vídeo de fundo** | Não existe *hero section*; megabytes de vídeo num produto cuja identidade é um precache enxuto |
| **Sons em arquivo (`.mp3`/`.wav`)** | Rompe a premissa do `sound.js`: peso, licenciamento e risco de 404 offline |
| **Fonte customizada no corpo** | Requisição render-blocking que o offline não honra |

### Como medir

| Métrica | Como | Meta |
|---|---|---|
| Peso do precache | soma dos `ASSETS` do `sw.js` | ≤ 150 KB transferidos |
| Lighthouse (mobile) | Performance e Acessibilidade | ≥ 90 em ambos |
| Fidelidade offline | modo avião: fonte, ícones e tarefas | 100% dos títulos em serifa |
| Perda offline | tarefas criadas sem rede que sobem | 100% |
| Conclusão do onboarding | % que chega ao cadastro | acompanhar linha de base |
| Adoção do som | % com som ligado após 7 dias | acompanhar linha de base |

### Riscos ativos

| Risco | Mitigação |
|---|---|
| Fila offline duplicar tarefas ao reconectar | O sync já faz *upsert por id*; a fila reusa o id local, nunca gera um novo no envio |
| `system-ui` variar entre Android e iOS | Aceito — a variação é menor que o custo de uma fonte que o offline não carrega |
| Som novo soar intrusivo em uso real | Interruptor de três estados junto com qualquer paleta sonora nova |
| Animação de entrada mascarar latência da IA | Coreografia limitada a ~600 ms — além disso é a interface mentindo sobre a espera |
| Ping externo do `/health` falhar e o Render dormir | Monitorar; sono de 15 min transforma qualquer espera em ~30-50s de cold start |

---

## 6. Histórico de sprints

> Escrito para ser entendido por quem não é da área técnica: termos técnicos foram
> mantidos, mas explicados.

### A história em um parágrafo

O MenteLeve nasceu como um protótipo para provar que a ideia funcionava. Deu certo —
mas nasceu com atalhos. Os meses seguintes foram gastos trocando cada atalho por algo
sólido: o banco de dados que perdia tudo virou um banco de verdade; o login que
confiava em qualquer um virou login com senha; a assistente que só conversava passou
a agir; o conteúdo das usuárias, legível para qualquer um com acesso ao banco, passou
a ser criptografado; e as chamadas de IA, que podiam travar o servidor inteiro,
passaram a ser assíncronas e protegidas contra falha do provedor.

### Série A — O MVP em 3 dias *(histórico, instruções técnicas obsoletas)*

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

### Série B — Migração para a nuvem *(27/08/2026, concluída)*

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

### Série C — Evolução do produto (Sprints 1–5) *(27–28/08/2026, concluída)*

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

### Série D — Fundação, percepção e presença (Sprints 6–8) *(31/08/2026, concluída)*

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

### O que essas sprints ensinaram

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

## 7. Ideias futuras / backlog de produto

Ideias registradas mas não implementadas — mantidas aqui para não se perderem nem
voltarem à pauta sem contexto do porquê ainda não existem.

### Recorrência de tarefas ("governança de ciclos")

Muitas tarefas da carga mental são ciclos repetitivos não documentados (compras de
consumo contínuo, contas mensais). Ideia original: a IA reconhece o padrão e oferece
automatizar —

> Usuária cria "Comprar fraldas e leite" → IA sugere: *"Notei que esta é uma compra
> de consumo contínuo. Deseja que eu crie um ciclo automático para te lembrar a cada
> 15 dias?"*

**Por que não existe ainda:** o schema não tem coluna para representar recorrência.
Foi tentado direto no prompt da IA ("toda semana") sem lugar para guardar a
informação, e isso gerava lixo por construção — removido do prompt até existir a
coluna. Pré-requisito: desenhar o campo de recorrência no modelo `Task` antes de
voltar a pedir isso à IA.

### Animação de abertura (splash)

O "Despertar da MenteLeve" — partículas soltas convergindo e se fundindo (morphing)
no isotipo, uma faísca piscando para sinalizar a IA nos bastidores, transição suave
para o onboarding. **Já implementado** em `isotipo.webp` (partículas convergindo,
`isoForm`, `isoRise`, faísca piscando) — é hoje a referência de qualidade de
animação do app, citada no [método de planejamento](#5-método-de-planejamento-e-restrições)
como padrão a igualar em outras telas.

### Diretrizes originais de tela confirmadas em produção

Do blueprint original de telas do MVP, os pontos abaixo continuam válidos como
guideline e já estão implementados — registrados aqui só para não se perderem:

- Hit targets (áreas de toque) de no mínimo 44×44px — "fácil de tocar com uma mão
  enquanto segura um filho ou faz compras".
- Estado vazio nunca é uma tela branca: ilustração acolhedora + uma ação clara (ver
  Sprint 7, [Série D](#6-histórico-de-sprints)).
- O "Aha Moment" da IA se anuncia com um ícone de faísca — consistente com a faísca
  da animação de abertura.

---

## 8. Documentos relacionados

- [`contexto_menteleve.md`](contexto_menteleve.md) — visão de produto, a dor, a
  proposta de valor e o modelo de negócio. Não consolidado aqui de propósito.
- [`../README.md`](../README.md) — como rodar localmente, deploy, endpoints.
- [`../Backend/README.md`](../Backend/README.md) — API, IA e criptografia em detalhe.
- [`../Frontend/README.md`](../Frontend/README.md) — PWA, datas, som, offline.
