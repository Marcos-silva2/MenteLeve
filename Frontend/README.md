# MenteLeve — Frontend (PWA)

App de gestão de carga mental. Frontend em **HTML/CSS/JS Vanilla + Tailwind (CDN)**, sem build, instalável como PWA.

## Como rodar

O app usa ES Modules e Service Worker, então precisa ser servido por HTTP (não abrir o `index.html` direto via `file://`).

```bash
# dentro da pasta Frontend
python -m http.server 5500
```

Depois acesse **http://127.0.0.1:5500** no navegador (ative o modo dispositivo móvel no DevTools para a experiência completa).

`API_BASE` (em `js/api.js`) detecta o ambiente sozinho: `localhost` em dev, Render em produção.

## Estrutura

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
    ├── categories.js       # categorias (Trabalho / Pessoal), mapeamento das antigas, grupo escolhido
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
        ├── connections.js  # espaços compartilhados (criar, entrar por código, membros)
        ├── knowledge.js    # aba Conhecimento: artigos com fontes (conteúdo em js/knowledge.js)
        └── profile.js      # perfil / conta
```

## Autenticação

E-mail + senha, com token **JWT**. O token fica no `localStorage` e vai em
`Authorization: Bearer` a cada chamada. No boot, `store.restoreSession()` revalida o
token em `/auth/me`; se o backend responder **401**, a sessão é limpa e o app volta
para o login (ver `api.onSessionExpired`).

## Datas das tarefas

O prazo é **estruturado**: `dueDate` (`AAAA-MM-DD`) + `dueTime` (`HH:MM`). O texto
amigável ("Hoje", "Amanhã • 10:00") é **derivado na exibição** por `dates.js::formatDue`
— nunca armazenado.

> Guardar o rótulo criava duas fontes de verdade: uma tarefa salva como "Amanhã"
> continuava exibindo "Amanhã" para sempre e **andava um dia no calendário a cada dia
> que passava**, sem nunca ficar atrasada. O campo `due` (texto livre) só permanece
> como fallback de exibição para tarefas criadas antes dessa mudança.

Cuidado ao mexer: `new Date('2026-08-27')` é interpretado como meia-noite **UTC** e
volta um dia no Brasil. Use `dates.js::dateFromKey` / `keyOf`, nunca o construtor direto.

## Modo offline

O app é *local-first*. Sem backend, `store.login()` entra em modo local com tarefas de
demonstração, e `dates.js::resolveDue` resolve as datas no próprio cliente — senão quem
está sem conexão não veria as tarefas no calendário (não existe fila de sincronização).

Ao sincronizar, o store faz **upsert por id** (`store.upsertTasks`), nunca substitui a
lista inteira: isso apagaria tarefas criadas offline e rebaixaria a prioridade, que o
backend não persiste.

## Som

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

## Sugestões da Bruna

Depois de criar uma tarefa, a Bruna só fala se tiver algo **útil** — `js/suggestions.js`
(`buildSuggestions`, puro e testado, é o único lugar da lógica):

- **Passos (0 a 3, curtos):** os da IA valem (sem enchimento, sem repetir, sem o que já existe como tarefa
  no dia); se a IA não mandou nenhum e o compromisso é **reconhecido** pela base de conhecimento
  (`REGRAS`: entrevista, apresentação, viagem, consulta, prova, relatório, proposta, reunião, conta,
  organizar a casa…), entram os passos dessa base. **Tarefa simples fica sem passos** (ligar, comprar pão,
  treinar). Em "organizar a casa" os ambientes vêm **desmarcados**: a pessoa escolhe por onde começar.
- **Lembrete:** o quando é **calculado aqui** (`quandoLembrar`), nunca inventado: *preparo* = véspera, sem
  horário; *início* = 30 min antes do horário (exige horário e que o momento não tenha passado); hoje não há
  véspera. Sem data, sem lembrete. Um por tarefa.
- **Avisos de contexto** (nada sai do aparelho): conflito de horário, **dia cheio** (≥ 5 tarefas ou ≥ 6 h —
  então no máximo 1 passo e nenhum lembrete, para não aumentar a carga; sugere um dia mais livre ou dividir
  com um espaço) e **tarefa repetida** (não empilha sugestões).

O modal ("A Bruna sugere" / "A Bruna avisa", quando só há aviso) deixa marcar ou desmarcar cada item.
As sugestões são calculadas **antes** de criar a tarefa, para ela não contar como repetida de si mesma.
Os limites espelham `Backend/app/ai.py`. Para ensinar um compromisso novo, acrescente uma entrada em
`REGRAS` (regex sobre o título sem acento, `cats` opcional, `exceto` para falsos positivos) e um caso em
`tests/suggestions.test.mjs`.

## Convenções de interface

- **Formulário de nova tarefa** (`components/taskSheet.js`): o essencial fica à vista (texto, **Onde**,
  Quando, hora); categoria, repetição e prioridade ficam em **Mais opções**, recolhido por padrão —
  a IA já escolhe categoria e prioridade. No computador é um modal **dentro** do fundo escuro
  (`scrim`), com altura máxima e rolagem própria; no celular é uma folha na base.
- **Rolagem** fina e na cor do tema (`scrollbar-width: thin` em `css/styles.css`); `.app-screen` e
  `.no-scrollbar` não mostram barra. `.fade-r` esmaece o fim de uma fileira que rola para o lado.
- **Interruptores** desligados usam `bg-muted/70` (≥ 3:1 contra o cartão branco); `soft-200` era
  claro demais para um controle.
- **Agenda**: no computador as células do mês são baixas (`lg:h-14`), dias livres da Semana ocupam
  uma linha, e a visão Dia rola sozinha até a hora atual (ou a primeira tarefa).

## Dimensionamento (tamanhos de janela)

O app foi verificado de **280 px a 2560 px**, em pé e deitado, sem rolagem nem corte horizontal em nenhuma
tela. Regras que sustentam isso (`css/styles.css`, bloco "Dimensionamento"):

- **Zoom por pinça liberado** (o viewport não tem mais `user-scalable=no`). Para o iOS não dar zoom
  sozinho ao focar um campo, em telas de toque `input/textarea/select` usam 16 px (`pointer: coarse`).
- **Folha de baixo** (`.sheet`: nova tarefa e menus) tem `max-height: 92dvh` e rola por dentro — em
  celular deitado ela passava da tela e o título/o botão ficavam inalcançáveis.
- **Tela baixa** (≤ 520 px de altura, abaixo de 1024 px de largura): barra de baixo compacta (rótulos
  escondidos; cada botão tem `aria-label`), menos respiro no topo, título e botão `+` menores.
- **≤ 360 px**: títulos menores e a linha de data/hora da nova tarefa **quebra** em vez de cortar o campo.
- **1024–1279 px**: barra lateral de 216 px e **sem** o painel "Sua semana" (a lista de tarefas ocupa a
  largura; antes ficava com ~360 px). O painel volta a partir de 1280 px.
- **≥ 1536 px**: a coluna de conteúdo vai a 1240 px (antes 1080). Não há escala automática de fonte: o
  app respeita o zoom do navegador e a escala do sistema.

## Temas de cor

O app tem 5 temas (**Grafite é o padrão**); a escolha fica em **Perfil → Cor do app**.
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

## Repetição de tarefas

`js/dates.js` espelha `Backend/app/recurrence.py`: `nextOccurrence` (com dias específicos e
fim da série), `detectWeekdays`, `detectUntil`, `firstOccurrence` e `recurrenceLabel`. Dias no
padrão do Python (**0 = segunda**); use `weekdayOf(chave)`, nunca `Date.getDay()` direto.
O seletor (`components/recurrencePicker.js`) é o mesmo na criação e na edição; a edição fica
no menu da tarefa (pressão longa / botão direito) e, offline, entra na fila como `update`.

## Agenda: Mês, Semana e Dia

A Agenda tem três visões (`views/agenda.js`), lembradas em `menteleve.agendaView`; sem
escolha salva, quem usa o filtro Trabalho começa na Semana. A lógica de horários fica em
`js/timeline.js` (puro, testado): `intervalOf` (sem `endTime`, 30 min), `conflictIds`
(sobreposição no mesmo dia; encostar não conta), `layoutDay` (colunas para blocos
sobrepostos) e `hourRange` (07–20, ampliado se preciso). `endTime` só vale com `dueTime` e
depois dele (`cleanEndTime`, igual ao backend).

## Espaços compartilhados

A tela **Conexões** (`views/connections.js`) cria espaços, entra por código, mostra membros e
deixa o dono trocar o código ou remover alguém. O `store.js` guarda a lista em `state.spaces`
(cache; offline mostra a última) e a Home ganha um chip de filtro por espaço, o selo
"👥 Espaço · Autor" e o campo **Onde** no formulário de nova tarefa. Subtarefa herda o espaço
da mãe. `canDeleteTask` só esconde a lixeira; quem decide é o backend (403).

- **Escape obrigatório:** título de tarefa e nome de pessoa agora vêm de **outros usuários**.
  Tudo que entra em `innerHTML` passa por `esc()` (`ui.js`); sem isso um membro injeta HTML na
  tela dos outros. Ao criar um template novo com texto de tarefa/nome, use `esc()`.
- **Atualização:** o que os outros fazem só chega se o app perguntar. `app.js` busca de novo ao
  voltar para o app e a cada minuto (no máximo 1 vez por 30 s), sem redesenhar por cima de
  formulário ou diálogo aberto.

## Equilíbrio da semana

`js/balance.js` (`weekBalance`, puro e testado) resume a semana por grupo: tempo agendado (só tarefas
com horário; sem fim contam 30 min), tarefas e concluídas, e uma mensagem. Aparece no topo da
visão Semana da Agenda e compara Trabalho × Pessoal **sempre com todas as tarefas**, mesmo com o
filtro de grupo ligado. Subtarefas ficam de fora e recorrentes contam só a ocorrência atual.

## Categorias

`js/categories.js` é a fonte única: 4 de **Trabalho** (trabalho, reuniões, carreira, estudos)
e 5 de **Pessoal** (casa, família, saúde, finanças, pessoal). O backend espelha em
`Backend/app/categories.py`. As ids antigas (`filhos` → `familia`, `relacionamento` →
`pessoal`) são convertidas ao carregar o estado local e nas respostas da API.
O filtro **Tudo / Trabalho / Pessoal** (Home e Agenda) é lembrado em `menteleve.group` (o id interno do grupo continua `vida`, só o rótulo exibido é "Pessoal").

## Imagens

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

## Testes

Sem dependências nem build — só o Node (>= 18) da máquina:

```
node --test "Frontend/tests/*.test.mjs"
```

Cobrem `dates.js`, `categories.js`, `theme.js` (inclusive o contraste de cada tema), a persistência/fila offline do `store.js` (com `localStorage` e `fetch`
simulados) e as mensagens de erro. Os casos de recorrência espelham `Backend/tests/test_recurrence.py`.

## Notas

- Login social (Apple/Google) está **desabilitado** com aviso "em breve" — não há OAuth real.
- **Espaços compartilhados** são reais e exigem conta no servidor (ver a seção abaixo).
- O **calendário menstrual é um módulo opcional** (Perfil → Calendário menstrual; desligado
  por padrão) e 100% local (`localStorage`), nunca vai ao backend — e sobrevive à expiração
  da sessão, por não pertencer à conta. Quem já o usava antes do módulo existir continua
  com ele ligado (migração em `store.js::migrar`). Desligar só esconde: os dados ficam.
- Estado persiste em `localStorage` (chave `menteleve.state.v1`).
- No **servidor**, o título das tarefas é criptografado (AES-256-GCM). No **aparelho**
  ele fica em texto puro no `localStorage` — é o que faz o modo offline funcionar. A
  criptografia protege o banco, não o dispositivo de quem já está com a sessão aberta.
  Por isso `store.clearSession()` limpa as tarefas ao sair da conta.
