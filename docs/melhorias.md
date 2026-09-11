# Especificação técnica: melhorias implementadas na tela inicial do MenteLeve

## Contexto

Tela inicial (`/`) de um app de organização pessoal com foco em bem-estar. A versão anterior sofria de: hierarquia visual invertida, metadados de tarefas com contraste insuficiente, saudação genérica "Admin", navegação redundante e ausência de estados vazios acolhedores. As melhorias foram aplicadas nos arquivos `src/styles.css`, `src/routes/__root.tsx` e `src/routes/index.tsx`.

## 1. Design tokens e tipografia (`src/styles.css`)

### Paleta semântica adicionada

Adicionar às variáveis CSS do tema as cores específicas da identidade MenteLeve:

```css
--wine: oklch(0.32 0.1 6);
--wine-deep: oklch(0.26 0.08 5);
--wine-soft: oklch(0.45 0.09 8);
--rose-accent: oklch(0.62 0.19 12);
--rose-soft: oklch(0.93 0.03 10);
```

E expor como cores utilitárias do Tailwind dentro de `@theme inline`:

```css
--color-wine: var(--wine);
--color-wine-deep: var(--wine-deep);
--color-wine-soft: var(--wine-soft);
--color-rose-accent: var(--rose-accent);
--color-rose-soft: var(--rose-soft);
```

### Fontes

- **Display/headings:** `"Fraunces"`, Georgia, serif (`--font-display`).
- **Body/UI:** `"DM Sans"`, ui-sans-serif, system-ui, sans-serif (`--font-sans`).
- Carregar via Google Fonts no `<head>` da raiz (`__root.tsx`) usando `<link>`.

## 2. Metadados e SEO (`src/routes/__root.tsx` e `src/routes/index.tsx`)

### Raiz (`__root.tsx`)

- Título padrão: `"MenteLeve — Organize sua mente com leveza"`.
- Meta description padrão com propósito do app.
- Tags OG/Twitter padrão (`og:type: website`, `twitter:card: summary_large_image`).
- Importar `appCss` via `?url` e injetar como `<link rel="stylesheet">` no `head`.
- Importar fontes do Google Fonts via `<link>` no `head`.

### Rota `/` (`index.tsx`)

- Título específico: `"MenteLeve — Sua semana com leveza"`.
- Description/OG/Twitter específicos para a home.

## 3. Layout da tela inicial (`src/routes/index.tsx`)

### Estrutura geral

Layout em grid de duas colunas no desktop:

```text
[Sidebar fixa à esquerda] [Main com grid lg:grid-cols-[1fr_340px]]
                              [Coluna principal]  [Card "Sua semana"]
[Floating Action Button (FAB) no canto inferior direito]
```

Classes principais do container:
- Body: `flex min-h-dvh bg-background`.
- Sidebar: `sticky top-0 flex h-dvh w-20 shrink-0 flex-col bg-wine-deep md:w-64`.
- Main: `flex-1 px-5 py-8 md:px-10 lg:px-14`.
- Grid interno: `mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_340px]`.

### Sidebar

- Logo: ícone `Sparkles` dentro de círculo `bg-card` + texto "MenteLeve" visível apenas em `md`.
- Navegação vertical com itens: Home, Agenda, Bruna (com hint "Sua assistente de bem-estar"), Conexões, Perfil.
- Item ativo (`Home`) usa `bg-rose-accent text-primary-foreground`.
- Itens inativos usam `text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground`.
- Card inferior "Premium ativo" com ícone `Crown` e texto secundário `text-primary-foreground/70`.
- Todos os links usam `aria-current="page"` quando ativos e `title` com hint.

## 4. Hierarquia visual e copy

### Saudação

- Substituir "Olá, Admin" por nome real da pessoa: `"Olá, Bruna."` + quebra de linha + `"Respire fundo…"`.
- Título `h1#page-heading` com `font-display text-3xl md:text-4xl font-semibold leading-tight text-wine`.

### Seção de tarefas

- Adicionar título de seção `h2`: `"Suas tarefas de hoje"` com `font-display text-xl font-semibold text-wine`.
- Barra de progresso acessível:
  - `role="progressbar"` com `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`.
  - Texto acima muda para `"Tudo concluído — um dia leve! 🎉"` quando todas as tarefas estiverem feitas.
  - Fundo da barra: `bg-rose-soft`. Preenchimento: `bg-rose-accent` com `transition-all duration-500`.

### Filtros por categoria

- Lista horizontal wrap de chips arredondados: `Tudo`, `Casa`, `Filhos`, `Trabalho`, `Saúde`, `Finanças`, `Relacionamento`.
- Estado ativo: `border-wine bg-wine text-primary-foreground`.
- Estado inativo: `border-border bg-card text-wine hover:border-wine/40`.
- Cada chip deve ter `min-h-11` (44 px touch target), `aria-pressed` e `role="group"` no container.
- Chips de categoria (exceto "Tudo") exibem um ponto `bg-rose-accent` à esquerda do texto.

## 5. Lista de tarefas

### Estrutura de cada item

Cada tarefa é um card arredondado:

```text
[Botão circular checkbox 44x44] [Título + linha de metadados]
```

Classes do card:
- `flex items-center gap-4 rounded-2xl border bg-card px-4 py-4 shadow-sm transition-opacity`.
- Quando concluída: `opacity-60`.

### Checkbox circular

- Botão com `size-11` (44 px), `rounded-full`, borda `border-2`.
- Estado não concluído: `border-rose-accent/50 hover:border-rose-accent`.
- Estado concluído: `border-rose-accent bg-rose-accent text-primary-foreground` + ícone `Check`.
- `aria-label` dinâmico: `"Concluir tarefa X"` / `"Reabrir tarefa X"`.

### Metadados da tarefa

Linha abaixo do título com:
- Data/hora usando ícone `Clock` (`size-3.5`).
- Prioridade usando ícone `Flag` + texto legível:
  - `PRIORITY_LABEL = { alta: "Prioridade alta", media: "Prioridade média", baixa: "Prioridade baixa" }`.
  - Prioridade alta: ícone preenchido `fill-rose-accent text-rose-accent`.
  - Outras: `text-wine-soft`.
- Chip de categoria: `rounded-full bg-rose-soft px-2 py-0.5 text-xs font-medium text-wine`.

Cor dos metadados: `text-wine-soft` (vinho mais escuro que o placeholder anterior, garantindo melhor contraste).

### Título concluído

Quando `done === true`, aplicar `line-through` no título.

## 6. Estado vazio (empty-state)

Quando a categoria filtrada não tiver tarefas, exibir:

```text
[Ícone Sparkles]
"Nada por aqui nesta categoria."
"Que tal planejar algo leve para hoje? Toque no + para começar."
```

- Container: `rounded-2xl border border-dashed border-wine/30 bg-card p-8 text-center`.
- Ícone `size-8 text-rose-accent`.
- Título: `font-medium text-foreground`.
- Subtítulo: `text-sm text-muted-foreground`.

## 7. Adicionar nova tarefa

### Forma expandida

Input inline + botão "Adicionar":
- Input: `min-h-11 flex-1 rounded-xl border border-input bg-card px-4 text-sm` com placeholder `"O que você quer lembrar?"`.
- Label oculto (`sr-only`) para acessibilidade.
- Botão submit: `min-h-11 rounded-xl bg-rose-accent px-5 text-sm font-semibold text-primary-foreground`.
- Ao submeter, a tarefa é criada com:
  - `id: Date.now()`
  - `title` do input
  - `category: filter === "Tudo" ? "Casa" : filter`
  - `date: "Hoje"`
  - `done: false`

### Floating Action Button (FAB)

- Botão fixo no canto inferior direito: `fixed bottom-6 right-6`.
- Tamanho `size-14` (56 px touch target).
- `rounded-full bg-rose-accent text-primary-foreground shadow-lg shadow-rose-accent/40`.
- Ícone `Plus`.
- `aria-label="Adicionar nova tarefa"`.
- Alterna o estado `adding` para mostrar/esconder o formulário.

## 8. Card "Sua semana"

- Posicionado na coluna direita (`aside` com `h-fit rounded-3xl border bg-card p-6 shadow-sm`).
- Título `h2#week-heading`: `"Sua semana"`.
- Subtítulo: `"Planeje com antecedência, sem surpresas."` com `text-muted-foreground`.
- Lista de dias (`WEEK`):
  - `"Hoje"`, `"Amanhã"`, `"Dom 6"`, `"Seg 7"`, `"Ter 8"`.
  - Cada linha: `flex min-h-11 items-center justify-between rounded-xl px-4 py-2.5`.
  - Dia atual (primeiro item) destaca com `bg-rose-soft` + texto `text-wine`.
  - Demais dias usam `bg-muted` + `text-foreground`.
  - Se `count > 0`, mostrar badge circular `bg-rose-accent text-primary-foreground`.
  - Se `count === 0`, mostrar texto `"livre"` em `text-muted-foreground`.
- Botão "Ver agenda completa" abaixo da lista com borda sutil `border-wine/30`.

## 9. Acessibilidade (a11y)

- Todos os botões e áreas de clique principais devem ter no mínimo 44 px de altura (`min-h-11` ou `size-11`/`size-14`).
- Ícones decorativos com `aria-hidden`.
- Estados `aria-pressed` nos filtros e `aria-current="page"` no item ativo da navegação.
- Progresso com `role="progressbar"` e atributos ARIA.
- Checkbox com `aria-label` dinâmico descrevendo a ação.
- FAB com `aria-label` e estados de foco visíveis (`focus-visible:ring-2`).
- Inputs com label oculta (`sr-only`) e estados de foco (`focus-visible:ring-2`).

## 10. Responsividade

- Sidebar colapsa para 80 px em mobile, expande para 256 px em `md`.
- Textos do sidebar e do card premium ficam ocultos em mobile (`hidden md:block`/`hidden md:inline`).
- Grid principal empilha em uma coluna abaixo de `lg`.
- Saudação aumenta de `text-3xl` para `text-4xl` em `md`.

## Checklist de validação

- [ ] Cores `wine-*` e `rose-*` estão no `src/styles.css` e expostas no `@theme inline`.
- [ ] Fontes Fraunces e DM Sans são carregadas via `<link>` no `head` da raiz.
- [ ] Título da página é "MenteLeve — Sua semana com leveza".
- [ ] Saudação usa nome real da pessoa (ex: "Olá, Bruna.") e título de seção "Suas tarefas de hoje".
- [ ] Metadados das tarefas usam `text-wine-soft` e prioridade exibe ícone + texto.
- [ ] Checkbox e chips de filtro têm altura mínima de 44 px.
- [ ] Estado vazio é exibido quando filtro não retorna tarefas.
- [ ] Barra de progresso mostra mensagem de celebração quando 100% concluído.
- [ ] FAB adiciona tarefa com categoria baseada no filtro atual.
- [ ] Card "Sua semana" consolida agenda e destaca o dia atual.
