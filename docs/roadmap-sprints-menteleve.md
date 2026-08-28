# 🗺️ Roadmap de Desenvolvimento e Sprints — MenteLeve

Este documento estabelece o planejamento estratégico e a divisão de sprints para a evolução do aplicativo **MenteLeve**, um sistema inteligente de gestão de carga mental para mulheres e mães. O objetivo principal é transformar o MVP atual em um produto seguro, altamente interativo, responsivo e com uma experiência de uso polida.

---

## 🎨 Visão Geral do Produto e Tecnologias Atuais
* **Frontend:** PWA (HTML, CSS, JavaScript Vanilla, Tailwind CDN) — hospedado na **Vercel**.
* **Backend:** FastAPI, SQLAlchemy 2.0, **PostgreSQL (Supabase)** — hospedado no **Render**.
* **Autenticação:** e-mail + senha (bcrypt) com token **JWT**.
* **Inteligência Artificial:** Gemini (gemini-2.5-flash) via Google AI Studio.
* **Design System:** Bordeaux Pink (Fundo: `#fff0f3`, Estrutura: `#590d22`, Destaque: `#ff4d6d`).

> Nota: este documento foi escrito quando o projeto ainda usava SQLite e GitHub Pages.
> A migração para Supabase + Vercel já foi concluída — ver [`Roadmap.md`](Roadmap.md).

---

## 🚀 ROADMAP ESTRATÉGICO

O roadmap está estruturado em **4 fases principais (Sprints)**, organizadas por ordem lógica de dependência técnica e impacto na experiência da usuária.

```
┌────────────────────────────────────────────────────────┐
│  SPRINT 1: Segurança, Autenticação e Infraestrutura    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  SPRINT 2: Evolução das Tarefas e IA "Bruna"           │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  SPRINT 3: Responsividade e Refinamento Visual         │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  SPRINT 4: Feedback Multissensorial e Ajustes Finos    │
└────────────────────────────────────────────────────────┘
```

---

## 🏃‍♂️ PLANEJAMENTO DAS SPRINTS

### 🔒 Sprint 1: Segurança, Autenticação e Infraestrutura ✅ CONCLUÍDA
**Foco:** Estabelecer uma fundação técnica segura para o armazenamento dos dados confidenciais das usuárias.

* **Melhoria da Autenticação (Login e Cadastro):**
  * [x] Substituir o header `X-User-Id` por **JWT**. *(Era uma falha crítica: o backend confiava no número enviado, então qualquer pessoa lia/apagava os dados de qualquer usuária mandando `X-User-Id: 1`.)*
  * [x] Hash de senhas com **bcrypt** (`app/security.py`).
  * [x] `routers/auth.py`: `POST /auth/register` (409 se e-mail existe) e `POST /auth/login` (401 genérico). Todas as rotas de dados exigem `Authorization: Bearer`.
  * [x] Frontend: nova tela de cadastro (`views/register.js`), token no `localStorage`, revalidação via `/auth/me` no boot e logout automático em 401.
  * [ ] **OAuth real (Google/Apple)** — adiado para uma sprint futura (decisão: priorizar JWT+senha). Os botões sociais estão desabilitados com aviso "em breve".
* **Segurança e Privacidade de Dados Sensíveis:**
  * [x] **Calendário Menstrual** permanece 100% local — confirmado: `agenda.js`/`store.js` só usam `localStorage`, sem nenhuma chamada à API. Os dados do ciclo agora também **sobrevivem à expiração da sessão** (não pertencem à conta).
  * [x] SQL Injection — já coberto: todo o `crud.py` usa o ORM do SQLAlchemy com queries parametrizadas, sem SQL cru em caminho de request.
* **Verificação de Erros Fundamentais:**
  * [x] Migração para **PostgreSQL (Supabase)** concluída — fim da perda de dados a cada deploy.
  * [x] Cold start do Render mitigado com ping externo em `/health`.

**Revisão de segurança do código novo:** sem vulnerabilidades introduzidas
(assinatura JWT com allowlist de algoritmo, `exp` verificado, contas legadas sem
senha bloqueadas, hash nunca exposto nas respostas, sem SQLi no `_ensure_columns`).

**Pendência registrada (pré-existente, fora desta sprint):**
`POST /auth/me/premium?is_premium=true` permite que qualquer usuária autenticada
se conceda Premium. Hoje é inofensivo porque o pagamento é simulado — **precisa ser
corrigido antes de existir cobrança real.**

---

### 🧠 Sprint 2: Evolução das Tarefas e IA "Bruna" ✅ CONCLUÍDA
**Foco:** Elevar o core do aplicativo, facilitando a entrada de dados e tornando a assistente virtual mais proativa e integrada às ações de gerenciamento.

#### Parte A — Tarefas e extração de datas
* [x] `taskSheet` com mais campos: **campo de horário** adicionado (antes o horário só
  chegava via texto interpretado pela IA).
* [x] `/tasks/smart` com extração melhor. **A causa raiz não era o prompt:** a data era
  guardada como texto ("Amanhã", "Esta semana") e o calendário a reconvertia com regex.
  Agora existem `due_date` (ISO) + `due_time`, e o rótulo amigável é derivado na exibição.
* [ ] Tarefas recorrentes — **adiado**. O prompt pedia "Toda semana" ao modelo, mas o
  schema não representa recorrência; isso gerava lixo por construção. Removido do prompt
  (ele devolve a data da 1ª ocorrência). Recorrência real precisa de coluna própria.

**Dois bugs corrigidos de quebra:**
1. A tarefa "andava" no calendário — salva como "Amanhã", era reinterpretada todo dia,
   caminhando um dia para frente e **nunca ficando atrasada**.
2. "Esta semana" (um dos três atalhos do formulário) nunca aparecia no calendário.

**Erro de fuso evitado:** o Render roda em UTC; entre 21h e 00h no Brasil o servidor já
acha que é amanhã, e "amanhã" viraria +2 dias. O cliente passa a enviar a data local.

#### Parte B — A Bruna executa ações
* [x] `/ai/chat` com **function calling** do Gemini: `criar_tarefa` e `concluir_tarefa`.
  Excluir ficou de fora (destrutivo, com identificação por texto aproximado).
  **O modelo não escolhe id** — informa o título e o servidor faz o casamento
  (ignorando acentos/caixa) contra as tarefas da própria usuária. Com mais de uma
  candidata, ela pergunta em vez de escolher.
* [x] Confiabilidade: `AI_CHAT_TIMEOUT` próprio (duas idas ao modelo), fallback gentil,
  e **checagem de duplicata** — o timeout do cliente não cancela a requisição, então
  a usuária podia ver "falhei", repetir o pedido e ganhar tarefa duplicada.
* [x] Privacidade no prompt: não pedir/repetir dados de saúde; nunca mencionar o
  calendário menstrual (que é 100% local e nunca chega ao backend).

**Três bugs pré-existentes corrigidos junto** (sem eles o recurso nasceria quebrado):
1. A Bruna travava após ~20 trocas — `chat.js` enviava o histórico inteiro e o backend
   aceita no máximo 40 mensagens; acima disso, 422 e queda permanente nas frases prontas.
2. Sincronizar apagava tarefas criadas offline e rebaixava prioridade "baixa" para
   "média" (o backend não persiste prioridade). Agora é atualização por id.
3. O histórico do chat sobrevivia ao logout — num aparelho compartilhado, a próxima
   pessoa herdava a conversa da anterior.

**Validação com Gemini real:** 7/7 nos casos de intenção (cria quando pedem para criar,
conclui quando dizem que terminaram, e **não age** em desabafo/conversa).

**⚠️ Achado operacional:** a chave do Gemini é do **tier gratuito (~20 req/min)** e a
cota estoura fácil. Pior: o **429 era engolido em silêncio** — a usuária via "estou com
um probleminha para pensar" e não havia como diagnosticar. Agora o motivo é registrado
em log. Avaliar um provedor de fallback (Groq tem 30/min e 1000/dia grátis) ou tier pago.

---

### 📱 Sprint 3: Responsividade e Refinamento Visual ✅ CONCLUÍDA
**Foco:** Deixar a interface do PWA fluida, moderna e ajustada a qualquer tamanho de tela.

* **Responsividade Multiplataforma:**
  * [x] **Vão de tablet fechado.** `.content-wrap` só tinha `max-width` dentro de
    `@media (min-width: 1024px)` — abaixo disso não havia limite nenhum, e entre 640px
    e 1024px (tablet, celular deitado) o conteúdo **esticava de ponta a ponta**, com os
    cartões de tarefa larguíssimos e o texto perdido à esquerda. Agora a coluna é
    centralizada com largura confortável, e o respiro lateral cresce a partir de 640px.
    Correção concentrada em `css/styles.css`; **nenhuma view precisou mudar**, porque
    todas as telas internas já usavam `.content-wrap`.
  * [x] Agenda/calendário validados nas três larguras.
* **Melhorias Visuais e Imagens:**
  * [x] **Imagens otimizadas — o ganho real da sprint.** `assets/` tinha 1,2 MB e o
    Service Worker baixava tudo na instalação. Várias imagens eram muito maiores que o
    tamanho exibido (`ML.png` era 812×626 para aparecer com 36px de altura).
    Convertidas para **WebP** e redimensionadas ao uso real:

    | Arquivo | Antes | Depois |
    |---|---|---|
    | `mulher-onboard` | 585 KB | **47 KB** (WebP) |
    | `isotipo` | 113 KB | **27 KB** (WebP) |
    | `ML` | 98 KB | **7 KB** (WebP) |
    | `icon-192.png` | 51 KB | 44 KB (PNG mantido — manifest) |

    **Precache do PWA: 1,2 MB → ~125 KB.** O `icon-512.png` continua PNG (compatibilidade
    do manifest) mas saiu do precache: só o manifest o usa, na instalação. O favicon e o
    avatar do perfil (44px) passaram a usar o ícone de 192px em vez do de 512px.
  * [ ] ~~Padronizar o Design System~~ — **não era necessário.** Auditoria mostrou que os
    valores hex espalhados pelos JS **já são exatamente os tokens** da paleta; os únicos
    destoantes são as cores da logo do Google, legítimas. Nada a corrigir.
  * [ ] Transições/animações novas — não feitas. O CSS já tem animações e respeita
    `prefers-reduced-motion`; sem problema concreto identificado, seria mudança
    puramente estética.

**Validação visual:** montado um harness com `puppeteer-core` dirigindo o Chrome já
instalado (sem baixar navegador, fora do repositório) — 24 capturas por rodada, em
390px / 768px / 1280px, em todas as telas. Comparação antes/depois confirmou: tablet
corrigido, **desktop e celular byte a byte idênticos** (zero regressão), nenhuma imagem
quebrada e nenhuma requisição com erro.

---

### 🎵 Sprint 4: Feedback Multissensorial e Ajustes Finos
**Foco:** Adicionar diversão e leveza ao aplicativo por meio de elementos de áudio e realizar um controle rigoroso de qualidade.

* **Audio-Feedback e Micro-interações:**
  * Adicionar efeitos sonoros discretos (áudios curtos e sutis) para ações importantes do aplicativo, como:
    * Micro-interações de recompensa ao concluir uma tarefa (efeito sonoro de "concluído" ou celebração suave) [5].
    * Alertas sonoros ao receber uma resposta ou conselho acolhedor da Bruna [5].
    * Sons de feedback tátil para cliques em botões principais do PWA.
  * Disponibilizar uma opção simples no perfil da usuária para desativar os sons (modo silencioso).
* **Varredura de Erros e Controle de Qualidade Geral:**
  * Executar uma varredura rigorosa de possíveis bugs no Service Worker (`sw.js`) para garantir que o suporte offline e o cache do PWA funcionem perfeitamente [6].
  * ~~Mitigar o "cold start" do Render~~ — ✅ já resolvido na migração (ping externo em `/health`).
  * Revisar erros de console do navegador, links quebrados e falhas de layout no deploy da **Vercel**.

---
*Este planejamento é dinâmico e deve ser revisado ao final de cada Sprint de acordo com os testes de usabilidade e feedbacks das usuárias do MenteLeve [4].*
