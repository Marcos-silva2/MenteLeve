# Roteiro de Fluxo de Telas e Funcionalidades - MenteLeve MVP

Este documento serve como o blueprint oficial de UX/UI e Desenvolvimento de Produto para o MVP de 8 semanas do aplicativo **MenteLeve**. O foco absoluto deste roteiro é a eliminação da sobrecarga cognitiva, velocidade de navegação e entrega imediata de valor (Aha Moment) através da Inteligência Artificial.

---

## 1. Mapa de Fluxo Macro (Navegação)

```
[Tela 1: Onboarding] ➔ [Tela 2: Login/Cadastro]
                              │
                              ▼
                  [Tela 3: Dashboard Principal]
                   ├──► [Tela 4: Nova Tarefa Inteligente] ──► [Pop-up: Sugestão IA]
                   ├──► [Tela 5: Calendário / Agenda]
                   └──► [Tela 6: Compartilhamento Familiar] ──► [Tela 7: Paywall Premium]
```

---

## 2. Detalhamento Tela por Tela

### Tela 1: Onboarding Sem Atrito (Carrossel)
* **Objetivo:** Gerar identificação imediata com a dor da usuária e apresentar a proposta de valor ("Second Brain").
* **Elementos Visuais:**
    * Fundo em tons pastéis e acolhedores (ex: verde menta desaturado ou creme quente).
    * Carrossel de 3 passos com ilustrações minimalistas:
        1. *"A sua mente não foi feita para guardar tudo."* (Gestão de carga mental).
        2. *"O MenteLeve pensa nos detalhes antes de você lembrar."* (Demonstração visual da IA).
        3. *"Compartilhe a carga com o seu parceiro em um clique."* (Alinhamento familiar).
* **Funcionalidades:**
    * Botão "Próximo" que muda o slide.
    * Botão "Pular" direcionando direto para o cadastro.
    * Botão "Começar Gratuitamente" no último slide.

### Tela 2: Autenticação Rápida (Login / Cadastro)
* **Objetivo:** Reduzir o atrito de entrada ao máximo para evitar desistências.
* **Elementos Visuais:**
    * Design limpo com o logotipo do MenteLeve.
    * Campos de formulário amplos e de fácil digitação no mobile.
* **Funcionalidades:**
    * Botões de login social em 1 clique: **Social Login com Apple** (Obrigatório para iOS) e **Social Login com Google**.
    * Opção tradicional: Campo de E-mail + Senha.
    * Validação de campos em tempo real (E-mail válido, senha com mínimo de 6 caracteres).

### Tela 3: Dashboard Principal ("Minha Mente")
* **Objetivo:** Centralizar o estado atual da rotina da usuária de forma visualmente limpa, sem causar ansiedade.
* **Elementos Visuais:**
    * **Saudação Personalizada:** Ex: *"Olá, Ana. Respire fundo, nós cuidamos do resto hoje."*
    * **Filtros Rápidos superiores:** "Hoje", "Esta Semana", "Atrasados".
    * **Seção de Categorias (Chips/Cards compactos):** Casa, Filhos, Trabalho, Saúde, Finanças, Relacionamento. Cada uma com cores muito sutis (tons pastéis) para identificação rápida.
    * **Lista de Tarefas Resumida:** Cards de tarefas com checkbox lateral, título da tarefa e data limite.
    * **Botão de Ação Flutuante (FAB):** Um botão "+" destacado no canto inferior direito para adicionar nova tarefa rapidamente.
* **Funcionalidades:**
    * *Check/Uncheck* instantâneo de tarefas (com animação sutil de sucesso).
    * Toque em uma categoria filtra a lista automaticamente.
    * Toque longo em uma tarefa abre opções rápidas (Editar, Excluir, Mover).

### Tela 4: Criação de Tarefa Inteligente (Bottom Sheet Dinâmico)
* **Objetivo:** Permitir que a usuária jogue a informação no app da forma mais rápida possível, sem preencher dezenas de campos.
* **Elementos Visuais:**
    * Painel que desliza de baixo para cima (Bottom Sheet), mantendo o contexto do Dashboard ao fundo.
    * Campo de texto único e expandido com o placeholder: *"Ex: Vacina do Léo dia 15 ou Comprar presentes de aniversário amanhã..."*
    * Seletores rápidos de Data e Categoria logo abaixo do texto.
* **Funcionalidades:**
    * **Input Natural (NLP):** Ao digitar "Consulta pediatra amanhã às 14h", o app extrai automaticamente a data e hora.
    * **Disparo do Motor de IA:** Ao clicar em "Salvar", os dados são processados e a tela exibe o Pop-up de Sugestão Preventiva da IA.

### Pop-up: O "Aha Moment" da IA
* **Objetivo:** Tangibilizar o valor único do produto logo na primeira utilização.
* **Elementos Visuais:**
    * Um modal ou toast animado que desliza sobre a tela com um ícone de faísca/IA.
* **Funcionalidades (Exemplos de Interação):**
    * Se a tarefa criada foi *"Vacina do Joãozinho dia 15"*, a IA exibe: *"Identifiquei a vacina. Deseja criar um lembrete automático para comprar o antitérmico no dia 14?"*
    * Ações do Modal: Botão **[Sim, adicionar]** (Cria a subtarefa de forma automatizada) e Botão **[Não, obrigado]**.

### Tela 5: Visão Calendário / Agenda Simplificada
* **Objetivo:** Permitir o planejamento a médio prazo espacialmente organizado.
* **Elementos Visuais:**
    * Calendário compacto em formato de linha semanal no topo (com opção de expandir para o mês inteiro).
    * Linha do tempo vertical mostrando os compromissos cronologicamente abaixo do calendário.
* **Funcionalidades:**
    * Toque em qualquer dia altera a lista cronológica abaixo.
    * Indicação visual (pequenos pontos coloridos embaixo do dia do calendário) mostrando se há tarefas da categoria Filhos, Saúde, etc.

### Tela 6: Compartilhamento Familiar (Hub de Gestão da Carga)
* **Objetivo:** Trazer o parceiro ou rede de apoio para o app, aumentando o LTV e criando defesa de mercado.
* **Elementos Visuais:**
    * Painel indicando quem faz parte do ecossistema familiar atual.
    * Cards com avatares/iniciais (ex: Usuária principal + Parceiro).
    * Botão destacado: *"Convidar Parceiro / Rede de Apoio"*.
* **Funcionalidades:**
    * **Geração de Link de Convite:** Envio via WhatsApp ou QR Code.
    * **Ativação de Regras de Notificação Cruzada:** Checkbox para ativar *"Notificar parceiro quando uma tarefa de 'Filhos' ou 'Contas' for criada ou concluída"*.

### Tela 7: Paywall Contextual (Upgrade Premium)
* **Objetivo:** Converter usuárias engajadas em assinantes pagantes sem ser intrusivo.
* **Elementos Visuais:**
    * Título forte focado em benefício: *"Zere a sua sobrecarga mental por completo"*.
    * Tabela comparativa simples de benefícios (Free vs Premium/Família).
    * Botões de assinatura com os valores sugeridos destacados em planos Mensais e Anuais (com desconto visível no anual).
* **Funcionalidades/Gatilhados de Exibição:**
    * Disparado logicamente quando o limite de 50 tarefas no plano gratuito é atingido.
    * Disparado imediatamente quando a usuária tenta clicar no botão de convidar o parceiro na Tela 6.

---

## 3. Estados Vazios (Empty States) e Micro-Interações

O sucesso de um aplicativo de produtividade está nos detalhes em que não há dados cadastrados.

1.  **Dashboard Vazio (Primeiro Acesso):**
    * Não exiba uma tela branca. Exiba uma ilustração acolhedora e o texto: *"Sua mente parece limpa por aqui. Que tal registrar a primeira pendência para começar a relaxar?"* com uma seta apontando explicitamente para o botão "+".
2.  **Animação de Conclusão:**
    * Ao marcar o checkbox de uma tarefa, aplicar um efeito leve de *fade-out* e um som de clique extremamente suave e satisfatório, liberando endorfina e reforçando positivamente o uso do app.

---

## 4. Checklist para Design & Desenvolvimento Inicial

Ao projetar e codificar estas telas no React Native durante as próximas semanas, assegure-se de que:
- [ ] O tamanho dos botões de toque (hit targets) possui no mínimo 44x44px (fácil de tocar com uma mão enquanto segura um filho ou faz compras).
- [ ] O contraste de cores dos textos em relação ao fundo está em conformidade com as diretrizes de acessibilidade (WCAG AA).
- [ ] O tempo de resposta para abrir o Bottom Sheet de nova tarefa é menor que 100ms.
- [ ] A chamada de API da OpenAI acontece de forma assíncrona para não travar a UI enquanto a usuária digita ou salva.