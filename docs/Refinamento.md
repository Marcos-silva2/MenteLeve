# 🧭 Refinamento — Plano de Melhorias do MenteLeve

> Escrito em **31/08/2026**, sobre o estado descrito em [`estado-atual.md`](estado-atual.md)
> (pós-Sprint 5). Cobre design, áudio, animação de imagens existentes e as
> pendências técnicas que sustentam tudo isso.

---

## 1. Restrições invioláveis

Qualquer proposta que quebre uma destas linhas é descartada antes de ser avaliada.
Elas não são preferências: são o que faz o produto funcionar hoje.

| Restrição | Por quê |
|---|---|
| **Sem build step** | O ciclo é editar arquivo e recarregar. Adicionar bundler custa mais do que qualquer biblioteca economiza |
| **Precache ≤ ~150 KB** | Offline real em rede instável. Cada CDN novo que entra no `sw.js` é peso que toda usuária baixa; cada um que fica de fora quebra o offline em silêncio |
| **`prefers-reduced-motion` respeitado** | Já honrado em 3 blocos do [`styles.css`](../Frontend/css/styles.css). Público-alvo em sobrecarga; movimento involuntário é hostil |
| **Áudio sintetizado, nunca arquivo** | [`sound.js`](../Frontend/js/sound.js) gera tudo pela Web Audio API: zero byte, zero licença, zero 404 offline |
| **Som sempre opcional** | Interruptor no Perfil. Toda função nova checa `isSoundEnabled()` antes de emitir |
| **Custo R$ 0/mês** | Vercel + Render + Supabase, todos no tier gratuito |

---

## 2. Método de planejamento

Três instrumentos, cada um resolvendo um problema diferente. Nenhum é decorativo.

### 2.1 Kano — classificar a natureza de cada melhoria

Define *o tipo de retorno*, não a ordem:

- **Básico** (a ausência irrita, a presença não encanta): fonte que carrega offline,
  fila de escrita offline, rate limit no login.
- **Linear** (quanto melhor, mais satisfação): tipografia, ritmo de leitura, latência percebida.
- **Encanto** (ninguém pede, todo mundo comenta): som de conclusão do ciclo,
  revelação coreografada das subtarefas da Bruna, ilustração do onboarding viva.

Regra: **nenhum item de Encanto entra numa sprint enquanto houver Básico aberto.**
Encantar quem perdeu uma tarefa criada offline não funciona.

### 2.2 MoSCoW — recortar o escopo de cada sprint

`Must` / `Should` / `Could` / `Won't`. O `Won't` é explícito e documentado (seção 8):
sem ele, propostas rejeitadas voltam a cada ciclo.

### 2.3 ICE — ordenar dentro do mesmo nível

`Impacto × Confiança ÷ Esforço`, cada eixo de 1 a 5, esforço em dias-dev.
Serve para desempatar, não para decidir sozinho — Kano tem precedência.

### 2.4 Definition of Done

Um item só está pronto quando **todos** valem:

1. Funciona offline (ou degrada em silêncio, sem erro visível).
2. Respeita `prefers-reduced-motion`.
3. Se emite som, respeita o interruptor do Perfil.
4. Não aumenta o precache em mais de 5 KB sem decisão explícita registrada.
5. Testado em viewport de 360 px e em desktop.
6. Sem dependência nova de CDN.

### 2.5 Cadência

Sprints de **2 semanas**. Fundação técnica (segurança, dados) é planejada em
cascata — escopo fechado, sem replanejar no meio, porque erro ali custa dado de
usuária. Camada de experiência (design, som, animação) é iterativa: entrega,
observa, ajusta.

---

## 3. Design

### 3.1 Tipografia — corrigir uma falha real, não só refinar

**Problema medido.** O [`index.html`](../Frontend/index.html) carrega Inter e
Playfair Display do Google Fonts com `<link rel="stylesheet">` render-blocking, e
**nenhuma das duas está na lista `ASSETS` do [`sw.js`](../Frontend/sw.js)**.
Consequência: no modo offline o app cai no fallback do sistema sem aviso — a
identidade tipográfica simplesmente desaparece exatamente na situação para a qual
o PWA foi construído.

**Correção.**

- Corpo de texto passa a `system-ui`. Elimina uma requisição render-blocking e
  reforça a percepção de app nativo. Inter e a stack de sistema são próximas o
  bastante para que a troca não seja perceptível em texto corrido.
- **Playfair Display permanece**, só nos títulos — é a assinatura da marca. Passa
  a carregar com `font-display: swap` e subset apenas dos pesos usados (600/700).
- O CSS já declara o fallback correto (Playfair Display, Georgia, serif), então
  o offline degrada para Georgia em vez de sans genérica.

*Kano: Básico. ICE: 5 × 5 ÷ 1 = 25.*

### 3.2 Ritmo de leitura

- `line-height: 1.5` no corpo, `1.25` em títulos. Hoje o valor é herdado do
  Tailwind e varia por utilitário, o que quebra o ritmo vertical entre cards.
- **Hanging bullets** nas listas de subtarefas: marcador fora do fluxo do texto
  (`text-indent` negativo + `padding-left`), para que a segunda linha alinhe com a
  primeira e não com o ícone.
- Alinhamento **sempre à esquerda**, nunca justificado. Em viewports de 360 px o
  texto justificado abre rios de espaço que custam legibilidade.

*Kano: Linear. ICE: 3 × 5 ÷ 1 = 15.*

### 3.3 Espaço branco funcional

O espaço negativo separa *grupos*, não itens. Regra a aplicar na Home e na Agenda:
espaçamento entre tarefas do mesmo dia menor que o espaçamento entre dias — a
hierarquia deixa de depender de linha divisória. Reduz a sensação de "mural" sem
adicionar um pixel de interface.

### 3.4 Estados vazios e de carregamento

Hoje [`login.js`](../Frontend/js/views/login.js) e
[`register.js`](../Frontend/js/views/register.js) usam `dataset.loading` sem
retorno visual, e a Home não tem esqueleto durante o sync. Uma usuária em rede
lenta vê tela parada.

- **Skeleton de tarefa**: 3 blocos com pulso suave, reaproveitando `riseIn`.
- **Estado vazio da Home** com a ilustração da marca e uma ação única, não um
  texto solto.

*Kano: Básico. ICE: 4 × 4 ÷ 2 = 8.*

### 3.5 `icon-512.png` — 296 KB

O maior arquivo do repositório, PNG, usado só pelo manifest na instalação. Está
corretamente fora do precache, mas quem instala paga os 296 KB. Reprocessar
(quantização de paleta ou WebP com PNG de fallback no manifest) deve levá-lo à
casa das dezenas de KB.

*Kano: Básico. ICE: 3 × 5 ÷ 1 = 15.*

---

## 4. Áudio

### 4.1 Princípio

O áudio do MenteLeve é **confirmação, não trilha**. Cada som responde a uma ação
da usuária, dura menos de 400 ms e tem pico de volume abaixo de `0.15`. Nada toca
sem gesto. Nada toca em sequência.

### 4.2 O que existe

[`sound.js`](../Frontend/js/sound.js) expõe três sons sintetizados e um
inicializador:

| Função | Timbre | Onde é usada hoje |
|---|---|---|
| `playComplete()` | duas notas ascendentes (Lá → Dó#) | conclusão de tarefa ([`home.js:165`](../Frontend/js/views/home.js#L165)) |
| `playMessage()` | nota única em 660 Hz | resposta da Bruna ([`chat.js:158`](../Frontend/js/views/chat.js#L158)) |
| `playTap()` | 520 Hz, 60 ms | FAB e interruptor do Perfil — **só 2 pontos** |
| `primeAudio()` | — | destrava o `AudioContext` no primeiro gesto |

### 4.3 Paleta sonora a criar

Todos seguem a mesma construção de `nota()`: onda senoidal, ataque de 15 ms,
decaimento exponencial. Isso é o que faz um som soar como *toque* e não como
*bipe*, e é o que mantém a família coesa.

| Nova função | Desenho | Gatilho | Por quê |
|---|---|---|---|
| `playAha()` | arpejo de 3 notas ascendentes (Lá → Dó# → Mi), ~350 ms | tarefa criada por `/tasks/smart` | O *Aha Moment* é o momento de maior valor do produto e hoje é **silencioso**. É o único som que merece ser mais rico que os demais |
| `playCycle()` | nota grave e morna (~440 Hz), longa e suave | marcação de período no calendário menstrual | Registro íntimo pede timbre distinto do de produtividade |
| `playUndo()` | duas notas **descendentes** (inverso de `playComplete`) | desfazer conclusão | Simetria sonora comunica reversão sem texto |
| `playError()` | nota única grave (~330 Hz), sem brilho | falha de sync ou de login | Falha hoje é só visual; som grave é entendido como erro sem soar como punição |

### 4.4 Ampliar cobertura de `playTap()`

Está em 2 pontos. Estender a: itens da bottom nav, botão de salvar do bottom
sheet, e navegação de mês na Agenda. Custo: uma linha por ponto.

### 4.5 Granularidade do interruptor

Hoje o Perfil tem um único liga/desliga. Evoluir para três estados —
**Tudo / Só conclusões / Silencioso** — mantendo o valor atual como padrão. Quem
acha o som do chat intrusivo desliga tudo hoje e perde a recompensa da conclusão,
que é justamente a que sustenta o hábito.

*Kano: 4.3 e 4.4 são Encanto; 4.5 é Linear. ICE médio: 3 × 4 ÷ 2 = 6.*

---

## 5. Animação de imagens existentes

O repositório tem **quatro** imagens. O objetivo aqui não é adicionar mídia — é
extrair mais das que já estão pagas.

### 5.1 Inventário e oportunidade

| Asset | Peso | Uso | Estado |
|---|---|---|---|
| `isotipo.webp` | 28 KB | splash | **Já animado** — partículas convergindo, `isoForm`, `isoRise`, faísca piscando. É a referência de qualidade |
| `mulher-onboard.webp` | 48 KB | onboarding, slide 1 | **Estático.** O próprio código comenta: *"Ilustração estática (mulher pensativa + balões), sem animação"* ([`onboarding.js:123`](../Frontend/js/views/onboarding.js#L123)) |
| `ML.webp` | 7.9 KB | logotipo no cabeçalho e na sidebar | Estático |
| `icon-192.png` | 45 KB | avatar no Perfil | Estático |

### 5.2 `mulher-onboard.webp` — a maior lacuna

É a primeira impressão do produto e é a única imagem grande sem vida. A técnica
já existe no projeto: `onboard-float` está definido no CSS e é aplicado ao ícone
de faísca do slide 2, não à ilustração.

**Proposta — "respiração e foco", sem tocar no arquivo:**

1. **Entrada.** Ao montar o slide, a imagem sobe 12 px com fade de 600 ms
   (`riseIn`, que já existe).
2. **Respiração.** `onboard-float` aplicado à ilustração: translação vertical de
   ±4 px em ciclo de 6 s. Quase imperceptível conscientemente; a diferença é a
   tela deixar de parecer congelada.
3. **Parallax de gesto.** No arraste do carrossel, a ilustração desloca a ~60% da
   velocidade do texto. Cria profundidade com uma linha de `transform`.

Custo: zero byte novo. Só CSS e uma classe.

### 5.3 Logotipo — vida no momento certo

`ML.webp` no cabeçalho ganha um brilho de 400 ms (reaproveitando `brunaGlow`, já
definido) **apenas** quando a Bruna conclui uma ação real via *function calling*.
Não é decoração: é a confirmação de que a assistente agiu, no lugar onde o olhar
já está.

### 5.4 Avatar do Perfil

`icon-192.png` ganha `lift` no hover (classe existente) e um pulso único ao
alternar Premium. Duas linhas.

### 5.5 Revelação coreografada das subtarefas

A melhor oportunidade de animação do produto, e não envolve imagem: quando a
Bruna decompõe uma tarefa, as subtarefas aparecem **todas de uma vez**. O
`.stagger` do [`styles.css:154`](../Frontend/css/styles.css#L154) só toca no mount
da view, nunca em conteúdo injetado depois.

Estender o mecanismo para conteúdo dinâmico faz a decomposição ser *vista*
acontecendo — a espera pela IA vira demonstração de trabalho em vez de latência.
Implementação: `animation-delay` calculado por índice via custom property
`--i`, sem biblioteca.

*Kano: Encanto. ICE: 4 × 4 ÷ 2 = 8.*

---

## 6. Outras melhorias

Estas não são estéticas, e é por isso que vêm primeiro no calendário.

### 6.1 Escalada de privilégio no Premium — `Must`

`POST /auth/me/premium?is_premium=true` ([`auth.py:52`](../Backend/app/routers/auth.py#L52))
aceita o valor vindo do cliente. Qualquer usuária autenticada se concede Premium.
Inofensivo enquanto o pagamento é simulado; **bloqueante no dia em que não for**.

Correção: remover o parâmetro da rota pública. A concessão passa a ocorrer só por
confirmação de pagamento no servidor.

*Kano: Básico. ICE: 5 × 5 ÷ 1 = 25.*

### 6.2 Fila de escrita offline — `Must`

Tarefa criada sem conexão **não sobe depois**. É perda de dado da usuária, no app
cujo argumento central é não deixar nada cair. O `store.js` já faz *upsert por id*
no sync, então a base para isso existe — falta a fila de operações pendentes e o
disparo no evento `online`.

*Kano: Básico. ICE: 5 × 4 ÷ 3 ≈ 6,7.*

### 6.3 Rate limit em `/auth/login` — `Should`

Tentativas ilimitadas. O custo do bcrypt (~250 ms) freia força bruta na prática,
mas não é trava. Implementar contagem por e-mail + IP com janela deslizante.

*Kano: Básico. ICE: 4 × 5 ÷ 2 = 10.*

### 6.4 Recorrência de tarefas — `Could`

Precisa de coluna própria antes de voltar ao prompt da IA. Foi removida porque o
schema não a representava e o modelo gerava lixo por construção. É funcionalidade,
não conserto — entra depois da fundação.

### 6.5 Nome da conta `Admin` em texto puro — `Should`

Anterior à criptografia. Converter com `python scripts/encrypt_existing.py --aplicar`.
Trabalho de minutos.

---

## 7. Sprints

### Sprint 6 — Fundação *(cascata, escopo fechado)* — **entregue em 31/08/2026**

**Tema: nada se perde.**

| | Item | Seção | Estado |
|---|---|---|---|
| `Must` | Escalada de privilégio no Premium | 6.1 | ✅ |
| `Must` | Fila de escrita offline → online | 6.2 | ✅ |
| `Must` | Fontes: `system-ui` no corpo, Playfair nos títulos, offline coerente | 3.1 | ✅ |
| `Should` | Rate limit em `/auth/login` | 6.3 | ✅ |
| `Should` | Nome da conta `Admin` criptografado | 6.5 | ⏳ operação manual no banco de produção |
| `Won't` | Qualquer item de som ou animação | — | — |

**O que mudou**

- `POST /auth/me/premium?is_premium=<bool>` **deixou de existir**. Ativar passou a ser
  `POST /auth/me/premium/simulate`, fechado pela variável `SIMULATED_CHECKOUT`;
  cancelar é `DELETE /auth/me/premium`, sempre permitido. O cliente não decide mais
  quem é Premium.
- `Backend/app/ratelimit.py`: janela deslizante em memória, contando só as falhas.
  Teto por e-mail (8/15 min) e por IP (30/15 min); um acerto zera a contagem.
- `Frontend/js/store.js`: fila de escritas pendentes persistida no `localStorage`,
  reenviada no boot e no evento `online`. Ao subir uma criação, o id local é trocado
  pelo id do servidor na tarefa, nas subtarefas e nas operações ainda enfileiradas —
  é isso que impede duplicatas.
- Inter saiu do `index.html`; o corpo usa a fonte do sistema e Playfair carrega fora
  do caminho crítico, degradando para Georgia quando offline.

**Critérios de aceitação**

- *Dado* que a usuária está sem rede, *quando* cria uma tarefa e a conexão volta,
  *então* a tarefa aparece no servidor sem ação manual e sem duplicar.
- *Dado* um token válido, *quando* se chama `POST /auth/me/premium?is_premium=true`,
  *então* a resposta não concede Premium.
- *Dado* o app em modo avião, *quando* se abre a Home, *então* os títulos usam
  Playfair ou Georgia — nunca sans genérica.

### Sprint 7 — Percepção *(iterativa)* — **entregue em 31/08/2026**

**Tema: o app responde.**

| | Item | Seção | Estado |
|---|---|---|---|
| `Must` | `line-height` e hanging bullets | 3.2 | ✅ `line-height`; hanging bullets **dispensado** (ver abaixo) |
| `Must` | Skeleton de carregamento e estado vazio da Home | 3.4 | ✅ |
| `Must` | Revelação escalonada das subtarefas da Bruna | 5.5 | ✅ |
| `Should` | `icon-512.png` reprocessado | 3.5 | ✅ 289 KB → 14 KB |
| `Should` | Espaço branco por grupo na Home e Agenda | 3.3 | ✅ já estava correto (ver abaixo) |
| `Could` | `playAha()` no *Aha Moment* | 4.3 | ✅ |

**O que mudou**

- `line-height` de 1.5 no corpo e 1.25 nos títulos, na base do CSS. Os utilitários
  do Tailwind (`leading-tight`, `leading-none`) continuam vencendo onde já estavam.
- **Esqueleto de carregamento** na Home. O caso que ele corrige é concreto: primeiro
  acesso num aparelho novo, sessão salva e cache vazio — a tela dizia *"sua mente
  parece limpa"* para quem tinha trinta tarefas no servidor. Agora a lista vazia só
  aparece quando o sync terminou.
- **Estado vazio com uma ação real** (`Criar a primeira tarefa`) no lugar da seta que
  apontava para o FAB — no desktop o botão fica longe do texto, e a seta pedia que a
  usuária descobrisse sozinha o que fazer.
- **`.reveal`**: entrada escalonada por índice (`--i`), para conteúdo injetado depois
  do mount. Aplicada aos passos no modal do *Aha Moment* e às subtarefas que chegam
  à Home. Só os itens **novos** animam: os que já estavam na tela não re-entram.
- **`playAha()`**: três notas ascendentes (Lá → Dó# → Mi). É o único som de três
  notas do app, e o momento de maior valor do produto deixou de ser mudo.
- **Ícones em WebP** com o PNG mantido como fallback no manifest:
  `icon-512` 289 KB → 14 KB, `icon-192` 44 KB → 4 KB. O WebP de 192 entrou no
  precache no lugar do PNG, o que tirou 41 KB do pacote offline.

**Duas correções ao próprio plano**

- **Hanging bullets não têm onde ser aplicados.** O app não tem um único `<ul>/<li>`:
  toda "lista" é flex com o ícone em `shrink-0` ao lado do texto, arranjo em que a
  segunda linha já alinha com a primeira letra — que é exatamente o efeito procurado.
  Um utilitário `.hang` seria CSS morto.
- **O espaço branco por grupo já estava certo.** Home: `mb-1` entre tarefa-mãe e seus
  passos, `mb-3` entre grupos. Agenda: `gap-2` dentro do dia, `mb-6` entre dias. A
  regra "intra-grupo menor que inter-grupo" já valia.

**Medição que contraria a documentação**

O precache **não é ~125 KB**, como está escrito em vários documentos desde a Sprint 3.
Medido arquivo a arquivo pela lista `ASSETS` do `sw.js`: **264 KB em disco** e
**~149 KB transferidos** (gzip nos textos; as imagens já chegam comprimidas) — depois
da economia de 41 KB desta sprint. Os números do estado atual e do README foram
corrigidos; o histórico das sprints anteriores ficou como está, por ser registro.
A meta da seção 9 (≤ 150 KB) faz sentido para o **transferido**, não para o disco.

**Critérios de aceitação**

- *Dado* `prefers-reduced-motion: reduce`, *quando* a Bruna decompõe uma tarefa,
  *então* as subtarefas aparecem instantaneamente, sem escalonamento.
- *Dado* sync em andamento, *quando* a Home monta, *então* o esqueleto aparece em
  até 100 ms e é substituído sem salto de layout.

### Sprint 8 — Presença *(iterativa)* — **entregue em 31/08/2026**

**Tema: o app tem vida.**

| | Item | Seção | Estado |
|---|---|---|---|
| `Must` | Ilustração do onboarding: entrada, respiração e parallax | 5.2 | ✅ |
| `Must` | Paleta sonora completa (`playCycle`, `playUndo`, `playError`) | 4.3 | ✅ |
| `Should` | Cobertura de `playTap()` estendida | 4.4 | ✅ 2 → 8 pontos |
| `Should` | Interruptor de som em três estados | 4.5 | ✅ |
| `Could` | Brilho do logotipo na ação da Bruna | 5.3 | ✅ + avatar da Bruna no chat |
| `Could` | Micro-animações do avatar do Perfil | 5.4 | ⚠️ reduzido (ver abaixo) |

**O que mudou**

- **Onboarding vivo.** `mulher-onboard.webp` deixou de ser estática: entra com
  `riseIn`, respira em ciclo de 6 s (±4 px) e desloca a 40% do dedo durante o arraste.
  A separação em dois elementos é o que faz funcionar — o de fora recebe o parallax
  (escrito por JS), o de dentro respira (animação CSS). Num elemento só, a última
  transformação a ser escrita apagaria a outra. **Nenhum asset novo.**
- **Paleta sonora completa.** `playCycle` (nota grave e longa, timbre próprio para um
  registro íntimo), `playUndo` (as notas de `playComplete` ao contrário — a simetria
  comunica a reversão sem palavra) e `playError` (nota grave curta, reconhecida como
  falha sem soar como punição).
- **Níveis de som** no lugar do liga/desliga: **Todos os sons / Só conclusões /
  Silencioso**. Cada som pertence a uma família (`recompensa` ou `ambiente`) e é a
  família que o nível libera. Ao escolher um nível, o Perfil toca uma amostra do que
  aquele nível **de fato** deixa passar. Estados antigos migram sozinhos: quem tinha
  desligado continua em silêncio.
- **`playTap()` de 2 para 8 pontos**: FAB, salvar do bottom sheet, sidebar, bottom
  nav, mês anterior, mês seguinte e "Hoje" na Agenda.
- **Confirmação da ação da Bruna**: quando ela cria ou conclui de verdade (via
  *function calling*), o avatar dela no chat e o logotipo na sidebar brilham por
  1,6 s. Antes, a única prova da ação ficava em outra aba.

**Correção fora do escopo, encontrada no caminho**

O `429` do rate limit da Sprint 6 caía no genérico *"Não foi possível entrar. Tente
novamente."* — que convidava a usuária a fazer exatamente o que estava bloqueado.
Agora a tela de login diz para aguardar alguns minutos.

**Um item entregue menor do que o planejado**

O item 5.4 falava do "avatar do Perfil (`icon-192.png`)". Na tela, o avatar é um
círculo com as **iniciais** da usuária; o `icon-192` aparece no cartão de instalação
do PWA, que já tinha `lift`. Sobrou pouco a animar: o avatar ganhou `lift` no hover e
nada mais. O "pulso ao alternar Premium" foi deixado de fora de propósito — o Premium
é ativado no paywall, e pulsar a cada visita ao Perfil seria ruído, não confirmação.

**Bug encontrado pelo próprio teste**

A migração do interruptor antigo não rodava. A checagem *"o estado salvo tem
`soundLevel`?"* era feita no objeto **já mesclado** com o padrão — onde o campo novo
sempre existe. Quem tinha desligado o som voltaria a ouvir tudo. Corrigido: a
migração decide pelo objeto cru do `localStorage`.

**Critérios de aceitação**

- *Dado* o som desligado no Perfil, *quando* qualquer gatilho novo dispara,
  *então* nenhum áudio é emitido e nenhum erro é registrado.
- *Dado* o primeiro acesso, *quando* o onboarding abre, *então* a ilustração entra
  animada e o precache permanece inalterado.

---

## 8. `Won't` — decidido e documentado

Registrado para não voltar à pauta a cada ciclo.

| Proposta | Motivo |
|---|---|
| **GSAP** | Dezenas de KB via CDN para coreografia que `animation-delay` já entrega. Contradiz o precache enxuto |
| **AOS (Animate On Scroll)** | Revelar tarefas conforme a rolagem adiciona ruído a uma lista que a usuária quer ler de uma vez. Contrário à premissa do produto |
| **Swup** | O mini-router por hash com `viewEnter` já elimina o flash branco. Swup pressupõe navegação multi-página |
| **Lottie** | ~250 KB de runtime para substituir ícones vetoriais que já são SVG inline. Não há GIF no repositório |
| **Vídeo de fundo** | Não existe *hero section*: o app é PWA atrás de login. E megabytes de vídeo num produto cuja identidade é ~125 KB de precache |
| **Sons em arquivo (`.mp3`/`.wav`)** | Rompe a premissa do `sound.js`: peso, licenciamento e risco de 404 offline |
| **Fonte customizada no corpo** | Requisição render-blocking que o offline não honra. Ver 3.1 |

---

## 9. Como medir

Sem instrumentação, "ficou mais bonito" não é verificável.

| Métrica | Como | Meta |
|---|---|---|
| Peso do precache | soma dos `ASSETS` do `sw.js` | ≤ 150 KB **transferidos** ao fim da Sprint 8 (em 31/08: 264 KB em disco, ~149 KB transferidos) |
| Lighthouse (mobile) | Performance e Acessibilidade | ≥ 90 em ambos |
| Fidelidade offline | modo avião: fonte, ícones e tarefas | 100% dos títulos em serifa |
| Perda offline | tarefas criadas sem rede que sobem | 100% |
| Conclusão do onboarding | % que chega ao cadastro | linha de base na Sprint 7, +10% na 8 |
| Adoção do som | % com som ligado após 7 dias | linha de base na Sprint 8 |

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Fila offline duplicar tarefas ao reconectar | O sync já faz *upsert por id*; a fila deve reusar o id local, nunca gerar um novo no envio |
| `system-ui` variar entre Android e iOS | Aceito. A variação é menor que o custo de uma fonte que o offline não carrega |
| Som novo soar intrusivo em uso real | Interruptor de três estados (4.5) entra na mesma sprint que a paleta ampliada |
| Animação de entrada mascarar latência da IA | Coreografia limitada a 600 ms. Além disso é a interface mentindo sobre a espera |
| Ping externo do `/health` falhar e o Render dormir | Monitorar; sono de 15 min transforma qualquer animação de carregamento em espera de 30 s |
