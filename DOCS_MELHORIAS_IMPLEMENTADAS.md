# MenteLeve — Melhorias implementadas

- **Parte 1 — TA-01, TA-03 e TA-04** (testes, tarefas recorrentes, UX Writing). O TA-02 (recuperação de senha) foi implementado e depois **removido a pedido** — ver o aviso logo abaixo.
- **Parte 2 — V-01 a V-05** (melhorias visuais e de UI/UX): ao final do arquivo.

---

> **Aviso:** a recuperação de senha (TA-02) foi removida a pedido, por completo. As seções abaixo já refletem isso.

## PARTE 1 — TA-01, TA-03 e TA-04

Escopo: suíte de testes, tarefas recorrentes e
UX Writing empático. Tudo foi feito sobre o código real do repositório; onde o prompt e o código
divergiam, a decisão está registrada na seção 3.

---

### 1. Resumo das mudanças aplicadas

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

### 2. Mapeamento de arquivos

### Criados

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
| `DOCS_MELHORIAS_IMPLEMENTADAS.md` | Este relatório. |

### Modificados

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

### Removidos

Nenhum.

---

### 3. Explicação técnica

### Banco e migração
- **Colunas novas** (`tasks.is_recurring BOOLEAN NOT NULL DEFAULT FALSE`, `tasks.recurrence_pattern VARCHAR(10)`) entram pelo `_ensure_columns` que já existia: roda no boot, é idempotente, e o `DEFAULT` faz as linhas antigas nascerem com valor válido. `supabase_schema.sql` traz o equivalente para rodar à mão.
- `EncryptedText`, `crypto.py`, as chaves do `.env` e o `styles.css` **não foram tocados**.

### Recorrência
- **Regra** (`nextOccurrence`, idêntica em Python e JS): primeira data estritamente depois de *hoje* e do prazo atual. Em dia/adiantada → prazo + 1 ciclo; atrasada → pula os ciclos perdidos mantendo o dia da semana/mês; sem prazo → conta de hoje. Mensal limita ao último dia do mês (31/jan → 28/fev).
- **Sincronização sem duplicar**: não existe "criar próxima". Offline, o aparelho rola o prazo local e enfileira a conclusão; no `flush`, o servidor aplica a mesma regra (o cliente manda sua data local em `?today=`) e o aparelho **adota a data devolvida**. Caso especial tratado: recorrente concluída *antes* de o `create` subir — o `create` já leva o prazo rolado, então a conclusão **não** é enfileirada (senão rolaria duas vezes). Coberto por testes.
- **IA**: o prompt de `/tasks/smart` pede `is_recurring` e `recurrence_pattern`; `_sanitize` só aceita `daily|weekly|monthly` (a flag é derivada do padrão) e, se o modelo esquecer, a detecção por regra completa. A tool `criar_tarefa` da Bruna ganhou `recorrencia` (enum). Sem IA, o fallback do servidor também detecta — "Tomar vitamina todo dia às 08:00" → `is_recurring=true`, `daily` sem nenhuma chave configurada.
- **Contrato do `/tasks/smart`**: a rota **não persiste** (é assim desde antes; o cliente cria via `POST /tasks`). Por isso o critério "gerar uma tarefa com `is_recurring=True`" foi atendido como: a resposta traz os campos e o cliente os repassa ao criar. Verificado ponta a ponta (seção 4).
- `TaskBase` valida: padrão sem flag liga a flag; flag sem padrão → 422.

### UX Writing
- `friendlyError(err, ctx)` devolve **texto fixo** por tipo (conexão / servidor 5xx / 401 / 429 com minutos / 400-422 / genérico) — nunca repassa o `detail` do servidor, que iria para o `innerHTML` do toast.
- Bruna: o `_FALLBACK` do servidor agora tranquiliza ("nada se perdeu") e aponta o `+` e a Home. No cliente, se a IA não respondeu e a usuária pediu uma ação ("anota…", "marca como feita…"), a resposta acrescenta que **nada foi feito** e como fazer à mão — antes, a resposta carinhosa parecia confirmação. A conversa nunca é apagada e a lista de tarefas segue utilizável.

---

### 4. Testes realizados e resultados

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

### 5. Melhorias não implementadas / limitações

1. **Reenvio após resposta perdida**: se o servidor aplicar a conclusão de uma recorrente mas a resposta se perder, o reenvio da fila rola o prazo uma segunda vez. Janela pequena; mitigação exigiria um id de operação idempotente.
2. **Mensal e fim de mês**: 31/jan → 28/fev, e a partir daí o "dia âncora" passa a ser 28 (não volta ao 31).
3. **Subtarefas de recorrente** (as sugeridas pela IA) não são reabertas nem reagendadas quando a mãe rola.
4. **Detecção offline (JS) × servidor (Python)**: JS reconhece um subconjunto ("toda semana/manhã/segunda", "todo dia 10", "todo mês"). Para "toda segunda" dita numa segunda-feira, o JS marca a *próxima* segunda; o Python marca hoje.
5. **Não existe edição de tarefa na interface** — então a recorrência só se define ao criar. `PATCH /tasks/{id}` já aceita os campos.
6. **Precache**: a folga apertada da primeira versão foi resolvida na Parte 2 (tirou `mulher-onboard.webp` do precache; ~105 KB).
7. **`Frontend/tests/` é publicado pela Vercel** junto com o site (inofensivo, mas público). Um `.vercelignore` resolveria; não foi criado.
8. Achados **preexistentes**, sem alteração: (a) `resolveDue('Esta semana')` ancora no **sábado** (`6 - getDay()`), embora o comentário diga domingo — o teste documenta o comportamento real; (b) `requirements.txt` limita `cryptography<47`, mas o venv local tem 50.0.1 (os testes rodaram com ela).

---

### 6. Configurações necessárias

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

## PARTE 2 — V-01 a V-05 (melhorias visuais)

Só frontend. Nenhuma alteração em `store.js`, `sound.js` nem no backend.

### 1. Resumo das alterações

| Item | O que mudou |
|---|---|
| **V-01 Chunking** | A Home agrupa as tarefas em accordions: **Hoje**, **Rotinas Cíclicas**, **Mais Tarde / Próximos Dias** (+ **Concluídas**, recolhida). Badge `#ffccd5`/`#590d22`, transição de 300 ms, funciona por clique, toque e teclado. |
| **V-02 Skeleton** | Classe `.skeleton-pulse` (pulso `#fff0f3` ↔ `#ffccd5`). Home: 3 cartões com as medidas do cartão real. Chat: balão-esqueleto com 3 barras enquanto a Bruna processa. |
| **V-03 Botões** | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-danger`, com hover, foco, `:active` (scale .98), desabilitado e carregando. Excluir agora **pede confirmação**. |
| **V-04 Toque/acessibilidade** | Alvos ≥ 44 px em toda a interface, foco visível global, exclusão sempre visível (sem hover), textos-link em cor legível. |
| **V-05 Vazios e navegação** | Estado vazio acolhedor na Home e nas categorias; estado próprio para "sem conexão"; estado vazio em Conexões; item ativo em pílula `#ffccd5` na bottom bar e na sidebar. |

### 2. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `Frontend/css/styles.css` | `.skeleton-pulse`/`.skeleton-wrap` (troca a faixa de luz antiga); `.acc-*` (accordion); `.btn*`; foco global; áreas de toque `::after`; `.nav-pill`. Removido o CSS do `.typing-dot` e do `.skeleton` antigo (ficaram sem uso). |
| `Frontend/js/views/home.js` | `sectionOf`/`groupTasks` (exportadas), accordions, esqueleto, estados vazios, exclusão com confirmação, alvos de 44 px, `aposSaida()`. |
| `Frontend/js/views/chat.js` | Balão-esqueleto; `try/finally` garante que o esqueleto saia mesmo em erro. |
| `Frontend/js/ui.js` | `confirmDialog()`; pílula na bottom bar e na sidebar; botão de senha de 44 px. |
| `Frontend/js/components/taskSheet.js`, `views/paywall.js`, `agenda.js`, `connections.js`, `login.js`, `register.js`, `profile.js` | Botões padronizados; `aria-busy` nos estados de carregamento; controles de 44 px; estado vazio em Conexões; `role="switch"`; links em `text-bordeaux-600`. |
| `Frontend/sw.js` | `CACHE` v41 → v42; `mulher-onboard.webp` fora do precache (ver seção 5). |
| `Frontend/tests/home.test.mjs` (novo) | 15 testes do agrupamento. |

### 3. Detalhes técnicos

- **Agrupamento (`sectionOf`)** — cada tarefa cai em **uma só** seção, sem tocar nos dados: concluída → *Concluídas*; em aberto com prazo hoje **ou vencido** → *Hoje* (atrasada pede atenção agora); recorrente que não caiu em Hoje → *Rotinas Cíclicas*; o resto (futura ou sem prazo) → *Mais Tarde*. Tarefas antigas só com o rótulo "Hoje" também caem em Hoje. Os filtros por categoria continuam valendo; a ordem original é mantida dentro de cada seção. O prompt pedia três seções; a quarta (**Concluídas**, recolhida por padrão) existe porque a lista antiga mostrava as concluídas no fim e não havia onde colocá-las sem violar "demais tarefas pendentes".
- **Accordion** — `grid-template-rows: 0fr → 1fr` + `opacity`, 300 ms, sem medir altura nem `max-height`. Ao fim do fechamento o painel vira `visibility:hidden` (sai da ordem de tabulação e dos leitores de tela). O gatilho é um `<button aria-expanded aria-controls>` dentro de `<h2>`; o painel é `role="region"`. Aberto, o corte de `overflow` é removido depois da animação (senão as sombras dos cartões e o contorno de foco seriam aparados). O estado aberto/fechado sobrevive aos re-renders.
- **Skeleton** — `.skeleton-wrap` nasce invisível e só aparece após **200 ms**: operação rápida termina antes e nunca pisca. Some no instante em que a lista chega, ou em erro (`isSyncing()` termina mesmo com falha; no chat, `finally`). Barras `aria-hidden`; leitores de tela ouvem "Buscando suas tarefas…" / "Bruna está pensando…" uma vez, por `role="status"`. `prefers-reduced-motion` troca o pulso por um tom fixo.
- **Vazio × falha** — lista vazia com sessão e servidor fora do ar mostra "Sem conexão por enquanto" + *Tentar de novo* (refaz o ping e a sincronização), e **não** "Tudo tranquilo". Com o servidor no ar (ou conta só local) aparece "Tudo tranquilo por aqui. Respire fundo!" (ou "…em Casa…") + *Adicionar tarefa*. Nunca durante o carregamento.
- **Botões** — `.btn` = 44 px mínimo, pílula, transição curta; `:active` encolhe 2% no próprio elemento. Os utilitários do Tailwind continuam vencendo sobre `.btn` (o CDN injeta o `<style>` depois deste CSS).
- **Exclusão** — não havia confirmação nenhuma (hover no desktop e menu de pressão longa apagavam direto). `confirmDialog()` (`role="alertdialog"`, foco inicial em "Manter", Tab preso no diálogo, Esc e toque fora cancelam, foco devolvido) foi adicionado. O texto vem por `textContent`.
- **Áreas de toque** — onde o controle é pequeno por desenho (chips, toggles) o `::after` transparente estende só a área clicável; nas subtarefas o botão de 44 px usa margem negativa para **não crescer a linha**. A lixeira agora é visível sempre (cor `#836169`), com `aria-label` e alvo de 44 px. No calendário, as células têm altura mínima de 44 px (a largura é ~41 px em telas de 390 px).
- **Correção de bug antigo (`prefers-reduced-motion`)** — o CSS desligava a animação de `.lift` (e dos cartões) com `!important`; sem animação o `animationend` **nunca dispara**, e concluir ou excluir uma tarefa não redesenhava a lista. `aposSaida()` executa direto sob movimento reduzido e tem um temporizador de segurança nos demais casos.
- **Navegação** — bottom bar: o ícone ganha um `.nav-pill` (`#ffccd5`, ícone `#590d22`) no item ativo. Sidebar: o ativo passou de rosa cheio para a pílula `#ffccd5` com texto/ícone `#590d22`.

### 4. Testes e validações

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

### 5. Pendências e limitações

1. **Contraste do botão primário** — a cor (`#ff4d6d`, texto branco) foi exigida pela especificação e dá **3,21:1**, abaixo de 4,5:1 para texto normal (o rótulo tem 16 px semibold, que não conta como "grande"). Não alterei a cor; o hover (`#ff758f`) é ainda mais baixo (2,56:1). Alternativas: texto `#590d22` sobre `#ff4d6d` (4,34:1, ainda curto) ou escurecer o fundo para algo próximo de `#d6284a`.
2. **Precache** — para caber nos 150 KB tirei `mulher-onboard.webp` (48 KB, só o 1º slide do onboarding) do `ASSETS`. Ele passa a ser guardado pelo cache de runtime na primeira exibição; só há perda para quem instala o app e fica offline **antes** de ver o onboarding. Sem essa retirada o precache estouraria (149,7 KB antes desta parte, com 0,3 KB de folga).
3. **Fonte** — o prompt cita Fraunces, mas o projeto usa **Playfair Display** (títulos) e a fonte do sistema (corpo), com decisão documentada no `index.html`. Mantive. Também não existe `text-wine-soft`: o token equivalente é `muted` (`#836169`, 4,90:1), que já cumpre o AA.
4. **Agenda** — a lógica (filtros, ordenação, dia selecionado) não foi tocada; só os alvos de toque e o título do mês, que agora quebra em duas linhas em vez de truncar ("Setembr…"). O agrupamento em accordions vale só para a Home.
5. **Calendário** — as células têm ~41 × 44 px em 390 px de largura (a grade de 7 colunas não comporta 44 px de largura sem mudar o layout).
6. **Botões não convertidos** — os chips de nível de som do Perfil e o botão de enviar do chat mantêm o estilo antigo (já ≥ 44 px). O *sheet* de nova tarefa não tem botão secundário "Cancelar" (fecha pelo toque fora), como antes.
7. **Não verificado** — nenhum leitor de tela real (NVDA/VoiceOver), nenhum aparelho físico nem Safari/Firefox (só Chrome). `grid-template-rows` animável exige Safari ≥ 16 / Chrome ≥ 107; em navegador mais antigo o accordion abre e fecha sem animar. O desempenho em aparelho fraco não foi medido: as animações são só de `opacity`/`grid-template-rows`/`background-color` em CSS.
8. O script de verificação no navegador é descartável e **não** está no repositório.
