# STYLEGUIDE.md

# Design System — Bordeaux Pink

## Visão Geral

Esta identidade visual combina tons profundos de bordeaux com rosas vibrantes e neutros suaves. O resultado é uma experiência sofisticada, feminina, moderna e emocionalmente envolvente.

### Personalidade da Marca

* Sofisticada
* Romântica
* Moderna
* Confiante
* Elegante
* Acolhedora

---

# Paleta Oficial

## Primárias

| Nome           | Cor       | Uso                                  |
| -------------- | --------- | ------------------------------------ |
| Night Bordeaux | `#590d22` | Fundo principal, superfícies escuras |
| Dark Amaranth  | `#800f2f` | Elementos estruturais e navegação    |
| Cherry Rose    | `#a4133c` | Componentes primários                |

## Secundárias

| Nome                | Cor       | Uso                        |
| ------------------- | --------- | -------------------------- |
| Rosewood            | `#c9184a` | Destaques e estados ativos |
| Bubblegum Pink      | `#ff4d6d` | CTA principal              |
| Bubblegum Pink Soft | `#ff758f` | Hover e interações         |

## Apoio

| Nome           | Cor       | Uso                      |
| -------------- | --------- | ------------------------ |
| Cotton Candy   | `#ff8fa3` | Cards suaves             |
| Cherry Blossom | `#ffb3c1` | Backgrounds secundários  |
| Pastel Petal   | `#ffccd5` | Áreas de destaque suaves |
| Lavender Blush | `#fff0f3` | Fundo claro principal    |

---

# Regra 60:30:10

## 60% — Cor Dominante

### Lavender Blush

`#fff0f3`

Utilizada na maior parte da interface:

* Fundo principal
* Telas
* Containers
* Modais
* Áreas de leitura
* Espaçamento visual

Objetivo:

Criar sensação de leveza, limpeza e conforto visual.

---

## 30% — Cor Secundária

### Night Bordeaux

`#590d22`

Aplicada em:

* Navbar
* Sidebar
* Cabeçalhos
* Rodapés
* Títulos principais
* Superfícies premium

Objetivo:

Transmitir sofisticação, autoridade e identidade.

---

## 10% — Cor de Destaque

### Bubblegum Pink

`#ff4d6d`

Aplicada em:

* Botões CTA
* Links importantes
* Indicadores ativos
* Badges
* Estados de sucesso visual
* Elementos de conversão

Objetivo:

Atrair atenção imediata.

---

# Distribuição Visual

60%

🩷 Lavender Blush (`#fff0f3`)

30%

🍷 Night Bordeaux (`#590d22`)

10%

🌸 Bubblegum Pink (`#ff4d6d`)

---

# Hierarquia de Cores

## Texto

### Título H1

`#590d22`

### Título H2

`#800f2f`

### Corpo

`#590d22`

### Texto Secundário

`#a4133c`

### Texto Desabilitado

`#ff8fa3`

---

# Botões

## Primary Button

Background:

`#ff4d6d`

Texto:

`#ffffff`

Hover:

`#ff758f`

Pressed:

`#c9184a`

---

## Secondary Button

Background:

`transparent`

Border:

`#800f2f`

Texto:

`#800f2f`

Hover:

`#ffccd5`

---

## Ghost Button

Texto:

`#a4133c`

Hover:

`#fff0f3`

---

# Inputs

## Estado Normal

Border:

`#ffccd5`

Background:

`#ffffff`

---

## Focus

Border:

`#ff4d6d`

Shadow:

```css
0 0 0 4px rgba(255,77,109,.15)
```

---

## Error

Border:

`#c9184a`

---

# Cards

## Card Padrão

Background:

`#ffffff`

Border:

`#ffccd5`

Shadow:

```css
0 8px 24px rgba(89,13,34,.08)
```

---

## Card Destaque

Background:

`#ffb3c1`

Border:

`#ff758f`

---

# Estados do Sistema

## Success

`#ff4d6d`

## Warning

`#ff8fa3`

## Error

`#c9184a`

## Info

`#a4133c`

---

# Gradientes Recomendados

## Hero

```css
linear-gradient(
  135deg,
  #590d22 0%,
  #800f2f 50%,
  #c9184a 100%
)
```

## CTA

```css
linear-gradient(
  135deg,
  #ff4d6d 0%,
  #ff758f 100%
)
```

## Soft Background

```css
linear-gradient(
  180deg,
  #fff0f3 0%,
  #ffccd5 100%
)
```

---

# Tokens CSS

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

---

# Regras de Uso

### Faça

✅ Use Lavender Blush como fundo principal.

✅ Use Night Bordeaux para estrutura e tipografia.

✅ Use Bubblegum Pink apenas para chamar atenção.

✅ Mantenha contraste alto para legibilidade.

✅ Preserve a regra 60:30:10 em todas as telas.

### Evite

❌ Grandes áreas usando Bubblegum Pink.

❌ Texto longo sobre fundos Bubblegum Pink.

❌ Misturar mais de três tons fortes na mesma tela.

❌ Usar Rosewood e Bubblegum Pink simultaneamente em CTAs concorrentes.

---

# Resumo

A identidade deve transmitir:

**Elegância + Romance + Sofisticação + Modernidade**

Distribuição oficial:

* 60% → `#fff0f3`
* 30% → `#590d22`
* 10% → `#ff4d6d`

Esta proporção deve ser mantida em todas as telas para garantir consistência visual e reconhecimento da marca.
