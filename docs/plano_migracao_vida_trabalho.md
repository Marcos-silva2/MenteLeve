# Plano de Migração — MenteLeve: Vida + Trabalho

> Ampliar o MenteLeve de "segundo cérebro para mulheres e mães" para **agenda de vida e trabalho**, sem descartar o que já existe.

**Data:** 29/09/2026
**Estratégia:** ampliar, não substituir. Tudo o que funciona hoje continua funcionando; o novo contexto entra como extensão.

---

## 1. Objetivo

Permitir que qualquer pessoa gerencie, num único app, as tarefas do **mercado de trabalho** (reuniões, entregas, prazos, estudos, carreira) e da **vida pessoal** (casa, saúde, família, finanças), com a IA antecipando os passos invisíveis dos dois mundos.

### Princípios

1. **Nada quebra para quem já usa.** Tarefas, categorias e dados atuais continuam válidos.
2. **O Design System original ("Bordeaux Pink") é mantido** como tema (em 01/10/2026 o padrão passou a ser o **Grafite**, por decisão do projeto). A mudança visual acontece por **personalização de cor**, não por substituição.
3. **Módulos de nicho viram opcionais.** O calendário menstrual fica, desligado por padrão.
4. **Entregas pequenas e publicáveis.** Cada fase vai para produção sozinha.

---

## 2. Visão geral das fases

| Fase | Tema | Esforço | Depende de |
|---|---|---|---|
| 0 | Alinhamento acadêmico e de produto | 1 dia | — |
| 1 | Temas de cor personalizáveis | 2–3 dias | — |
| 2 | Categorias vida + trabalho | 2–3 dias | — |
| 3 | IA e persona para os dois contextos | 3–4 dias | Fase 2 |
| 4 | Textos, onboarding e módulos opcionais | 2–3 dias | Fases 1–3 |
| 5 | Nova logo e identidade | 2–4 dias | Fase 1 |
| 6 | Recorrência avançada (base já existe) | 3–5 dias | Fase 2 |
| 7 | Visões diária e semanal + duração | 1 sprint | Fase 6 |
| 8 | Compartilhamento com equipe e relatório de equilíbrio (futuro, opcional) | várias sprints | Fases 6–7 |

As fases 1 e 2 são independentes e podem correr em paralelo.

---

## 3. Fases em detalhe

### Fase 0 — Alinhamento

- [x] Validar com o prof. Valter de Sales Santana que a ampliação do público continua dentro do escopo do Itinerário Extensionista 2. *(Confirmado em 01/10/2026.)*
- [x] Reescrever a justificativa das ODS *(feito no `README.md`)*:
  - **ODS 3:** sobrecarga e burnout na conciliação entre trabalho e vida pessoal. O recorte de mulheres e mães continua como público prioritário, não exclusivo.
  - **ODS 9:** sem alteração.
- [ ] Definir o novo slogan. Sugestão: *"Sua vida e seu trabalho, numa mente só — e leve."*

### Fase 1 — Temas de cor personalizáveis

O CSS já usa tokens (`--color-bg`, `--color-accent`, `--color-accent-hover`, `--color-muted`, `--color-surface` em [`Frontend/css/styles.css`](../Frontend/css/styles.css)). Isso permite trocar o tema sem reescrever componentes.

**Tarefas:**
- [x] Levantar cores fixas fora dos tokens (hex no `tailwind.config` de [`Frontend/index.html`](../Frontend/index.html), SVGs inline e classes Tailwind como `bg-[#...]`) e trocá-las por variáveis CSS.
- [x] Criar os temas como blocos `[data-theme="..."]` sobrescrevendo os tokens:

  | Tema | Fundo | Estrutura | Destaque | Observação |
  |---|---|---|---|---|
  | **Bordeaux Pink** | `#fff0f3` | `#590d22` | `#ff4d6d` | original (hoje opcional) |
  | Oceano | `#eef6fb` | `#0b3a53` | `#1f8ac0` | neutro/corporativo |
  | Floresta | `#f0f7f1` | `#1e4d2b` | `#3f9a5a` | calmo |
  | **Grafite** (padrão desde 01/10/2026) | `#f4f4f5` | `#27272a` | `#6366f1` | minimalista |
  | Lavanda | `#f6f2fd` | `#3b1f6b` | `#8b5cf6` | suave |

- [x] Manter a regra 60:30:10 em todos os temas e checar contraste AA (4,5:1 para texto) para cada combinação.
- [x] Adicionar um seletor de tema no **Perfil**, com uma amostra de cada paleta.
- [x] Persistir a escolha no `localStorage` e aplicá-la **antes do primeiro render** (script inline no `<head>`) para evitar flash de cor.
- [x] Atualizar o `theme-color` do `<meta>` e da barra do PWA conforme o tema.
- [ ] *(Opcional)* Sincronizar o tema com o backend (coluna `theme` em `users`) para ele acompanhar o usuário entre aparelhos.
- [ ] *(Futuro)* Modo escuro como variante de cada tema.

**Critério de pronto:** trocar o tema no Perfil muda o app inteiro, sem sobras de rosa, e a escolha persiste após recarregar a página.

> ✅ **Entregue (01/10/2026)** — verificado em Chrome real: 5 temas, nenhuma cor do Bordeaux sobrando nos textos, fundos e bordas, e persistência após recarregar. **Fora do critério, pendente para a Fase 5:** as imagens (ilustrações WebP, isotipo da abertura, ícones do PWA) continuam rosadas. Sem sincronização do tema com o backend (item opcional) e sem modo escuro.

### Fase 2 — Categorias vida + trabalho

**Categorias propostas** (as atuais são mapeadas, não apagadas):

| Grupo | Categorias |
|---|---|
| Trabalho | Trabalho, Reuniões, Carreira, Estudos |
| Vida (exibido como "Pessoal") | Casa, Família, Saúde, Finanças, Pessoal |

**Tarefas:**
- [x] Levantar as categorias atuais em `api.js`, `taskSheet.js`, `store.js`, `home.js`, `agenda.js` e no backend (`schemas.py`, `ai.py`).
- [x] Centralizar a lista de categorias em **um único módulo** no frontend e numa constante no backend.
- [x] Mapear as categorias antigas para as novas (tabela de-para) e escrever uma micro-migração em `database.py` (a coluna de categoria não é criptografada, então dá para atualizar via SQL).
- [x] Adicionar um filtro **Trabalho / Pessoal / Tudo** na Home e na Agenda.
- [x] Atribuir cor a cada categoria, derivada do tema ativo. *(Ícone por categoria: não feito — hoje é só o ponto colorido.)*
- [x] Atualizar os testes (`store.test.mjs`, `test_tasks.py`).

**Critério de pronto:** tarefas antigas aparecem na categoria nova correta e o filtro separa trabalho e vida.

> ✅ **Entregue (01/10/2026)** — `filhos` → `familia` e `relacionamento` → `pessoal` (aparelho, API e banco). O backend aceita as ids antigas na entrada, porque clientes com cache antigo ainda as enviam. O prompt da IA já lista as 9 categorias, mas o repertório de trabalho dele é a Fase 3.

### Fase 3 — IA e persona

- [x] Reescrever os prompts de `analyze` e `chat` em [`Backend/app/ai.py`](../Backend/app/ai.py) para cobrir o contexto profissional:
  - Subtarefas típicas de trabalho, por exemplo: reunião → pauta, envio do convite, ata; entrega → revisão, aprovação, envio.
  - Lembretes preventivos do tipo "prepare os slides na véspera".
  - Classificação nas novas categorias da Fase 2.
- [x] **Persona Bruna:** manter o nome e o tom acolhedor, ampliando o repertório para produtividade e equilíbrio entre trabalho e vida. *(Decidido: o nome "Bruna" fica; nome configurável não foi feito.)*
- [x] Atualizar a heurística de fallback em `api.js` (palavras-chave de trabalho: reunião, call, entrega, prazo, relatório, cliente…).
- [x] Montar um conjunto de ~30 frases de teste (metade trabalho, metade vida) e comparar a classificação antes e depois. *(Feito para a heurística local, `tests/classificacao.test.mjs`. Para a IA de verdade não dá para medir sem chamadas reais ao Gemini/Groq.)*

**Critério de pronto:** ao menos 90% das frases de teste caem na categoria certa, com subtarefas úteis.

> ✅ **Entregue (01/10/2026), com uma ressalva.** Prompts de análise e da Bruna reescritos (9 categorias descritas, exemplos de trabalho, linguagem neutra, aviso sobre dados confidenciais). A heurística local (modo sem IA) acerta 30/30 das frases de teste, **mas as regras foram escritas olhando essas mesmas frases**, então o número é otimista. O comportamento dos prompts novos com o Gemini/Groq reais **não foi validado**: o ideal é rodar umas 30 frases novas no app em produção e conferir à mão.

### Fase 4 — Textos, onboarding e módulos opcionais

> ✅ **Entregue (01/10/2026).** Fora do que está nos itens: a splash e o `manifest.json` ganharam texto/descrição novos, e o `sw.js` foi para a versão v47. Os textos das notificações push já eram neutros. As mensagens de erro de `ui.js` mantêm o 💗 (tom mais informal que o resto).

- [x] Revisar os textos de `onboarding`, `login`, `register`, `home`, `profile`, `chat` e `connections`, trocando a linguagem exclusiva a "mães" por uma linguagem inclusiva e neutra.
- [x] Onboarding com a pergunta **"Para que você vai usar o MenteLeve?"** (Trabalho / Pessoal / Os dois), que define o filtro inicial e o tom das sugestões.
- [x] **Calendário menstrual:** vira um módulo opcional, desligado por padrão, com ativação no Perfil. Para quem já usa, continua ligado (migração do estado local).
- [x] **Rede de apoio:** manter como está e ajustar o texto para "família ou equipe".
- [x] Atualizar `manifest.json` (nome, descrição), metatags e o texto de cache do `sw.js` (subir a versão do cache).
- [x] Atualizar `README.md` e `docs/indice.md` (contexto do produto e documentação consolidada).

### Fase 5 — Nova logo e identidade

> ✅ **Entregue (01/10/2026).** Logo novo (agenda + folha + faísca) em SVG que usa as cores do tema; ícones do PWA regenerados a partir dele em versão neutra (grafite). As três imagens rosadas (`isotipo.webp`, `ML.webp`, `mulher-onboard.webp`) foram removidas; a ilustração do onboarding virou SVG de tokens. Os ícones do PWA continuam estáticos e não acompanham o tema (limitação do navegador).

- [x] Briefing: a logo deve funcionar em **qualquer tema de cor**, ou seja, ser monocromática ou usar `currentColor`.
- [x] Produzir a logo em SVG com a cor herdando o destaque do tema (`fill: var(--color-accent)`).
- [x] Gerar os ícones do PWA (192, 512, maskable). *Limitação:* o ícone instalado é estático e não acompanha o tema; usar uma versão neutra.
- [x] Revisar as ilustrações WebP em `assets/`: as que forem muito rosadas ganham versão neutra ou passam a usar SVG com tokens.

### Fase 6 — Recorrência avançada

A base **já existe**: `is_recurring` + `recurrence_pattern` (`daily`/`weekly`/`monthly`), com o prazo rolando para a próxima ocorrência ao concluir. Ver [histórico de melhorias](indice.md#parte-3--histórico-de-melhorias). A rotina de trabalho pede mais:

- [x] **Dias específicos da semana** (ex.: seg/qua/sex) e **dias úteis**.
- [x] Data de término (`recurrence_until`).
- [x] Prompts da IA com exemplos de trabalho ("reunião toda segunda às 9h", "relatório todo dia 5").
- [x] Interface para **editar** a recorrência depois de criada. *(Menu da tarefa: pressão longa no celular, botão direito no computador → "Editar repetição". Ainda não há caminho só por teclado.)*
- [x] Manter a mesma regra em Python e JS, cobrindo os novos casos em `test_recurrence.py` e `dates.test.mjs`.

> ✅ **Entregue (01/10/2026).** Dias específicos e dias úteis, fim da série (concluir a última ocorrência fecha a tarefa), detecção por texto ("dias úteis", "de terça a quinta", "toda segunda e quarta", "até 20/12", "até dezembro"), campos novos na IA e na Bruna, edição com fila offline. Regra idêntica em Python e JS, com os mesmos casos de teste nos dois lados. Os prompts novos da IA não foram testados com o Gemini/Groq reais.

### Fase 7 — Visões diária e semanal + duração

- [x] Campo opcional de **duração** ou **hora de término** (blocos de tempo).
- [x] Visão **semanal** (padrão para quem escolheu "Trabalho") e visão **diária** com linha do tempo.
- [x] Destaque de conflitos de horário.

> ✅ **Entregue (01/10/2026).** Campo `end_time` (até) no backend e no formulário; a IA e o modo sem IA entendem "das 10h às 11h30", "call de 1h", "por 45 min". Agenda com abas **Mês / Semana / Dia** (lembrada; quem usa para Trabalho começa na Semana). A visão Dia é uma linha do tempo com blocos proporcionais à duração e tarefas sobrepostas lado a lado; conflitos aparecem na Home, na Semana e no Dia. Sem fim informado, a tarefa conta como 30 min. Fora do escopo: arrastar blocos para remarcar e editar o horário de uma tarefa já criada.

### Fase 8 — Futuro (fora deste plano)

- ~~Integração com Google Calendar e Outlook~~ — **descartada** por decisão do projeto (02/10/2026).
- [x] Espaços compartilhados com equipe. *(Entregue em 02/10/2026, versão enxuta: lista comum, convite por código, todos editam; apagar só quem criou ou o dono. Ver "Espaços compartilhados" nos READMEs. Fora do escopo: atribuir tarefa a uma pessoa, permissões por papel, histórico de quem mudou o quê, atualização em tempo real — hoje é consulta a cada minuto.)*
- [x] Relatório semanal de equilíbrio trabalho × vida (tempo por grupo de categorias). *(Entregue em 02/10/2026: cartão "Equilíbrio da semana" no topo da visão Semana da Agenda — tempo agendado, tarefas e concluídas por grupo, dia mais carregado e uma mensagem. Conta só tarefas com horário; recorrentes entram pela ocorrência atual.)*

---

## 4. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Perder a identidade que atrai o público atual | Médio | Bordeaux Pink segue disponível como tema; o público prioritário segue na comunicação |
| IA classifica pior ao ampliar o escopo | Alto | Conjunto de frases de teste (Fase 3) antes de publicar |
| Cores fixas escondidas quebram os temas | Baixo | Varredura de hex na Fase 1 e revisão visual tema a tema |
| Migração de categorias corrompe dados | Médio | Migração idempotente, testada em cópia do banco, com backup antes |
| Cache do Service Worker serve a versão antiga | Médio | Subir a versão do cache em cada fase com mudança visual |
| Escopo acadêmico rejeitado | Alto | Fase 0 antes de qualquer código |
| Mais texto de trabalho enviado ao Gemini/Groq | Médio | Aviso de privacidade atualizado: dados corporativos sensíveis passam pela IA |

---

## 5. Ordem sugerida de entrega

1. **Sprint A:** Fases 0, 1 e 2. O usuário já percebe o app como "novo": cores personalizáveis e categorias de trabalho.
2. **Sprint B:** Fases 3, 4 e 5. A IA, os textos e a logo passam a refletir o novo contexto.
3. **Sprint C:** Fase 6 (recorrência avançada).
4. **Sprint D:** Fase 7 (visões de agenda).

---

## 6. Decisões em aberto

- [x] Manter o nome **MenteLeve**? *(Mantido.)*
- [x] Persona: **Bruna** fixa ou nome configurável? *(Fixa, por ora.)*
- [x] O tema vai sincronizar com o backend ou ficar só no aparelho? *(Só no aparelho, por ora.)*
- [x] Calendário menstrual: opcional (recomendado) ou removido? *(Opcional, desligado por padrão.)*
- [ ] O modo escuro entra junto com os temas ou fica para depois?
