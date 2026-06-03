# MenteLeve: Estratégia de UX/UI Adaptativa (PWA Mobile-First)

Este documento adapta os padrões universais de UX/UI para o contexto específico do **MenteLeve**, focando na transição entre Mobile (uso principal) e Desktop (acesso PWA).

## 1. Princípios de Design "Spa Mental"
Independente do dispositivo, o MenteLeve deve manter a promessa de redução de sobrecarga.
* **Densidade:** Mantenha o respiro (white space). Desktop não deve ser um "dashboard financeiro denso", mas sim uma versão expandida e focada.
* **Foco:** A IA é o centro. Onde quer que o usuário esteja, o gatilho da IA deve ser visível.
* **Identidade:** O uso da paleta *Bordeaux Pink* deve ser consistente, evitando excesso de cores funcionais (apenas estados de erro/sucesso devem destoar).

## 2. Adaptação dos Padrões (MenteLeve Context)

| Categoria | Mobile (Foco: Ação/Rapidez) | Desktop (Foco: Visão Geral) |
| :--- | :--- | :--- |
| **Dashboard** | Lista vertical (Checklist) | Sidebar (Agenda semanal) + Lista principal |
| **Nova Tarefa (IA)** | Bottom Sheet (Focado no polegar) | Modal central (Focado no teclado/foco) |
| **Navegação** | Bottom Bar (Acesso rápido) | Sidebar lateral fixa (Mais visibilidade) |
| **Pop-up da IA** | Fullscreen ou 80% do ecrã | Modal central pequeno (tipo *pop-over*) |
| **Paywall** | Scroll vertical linear | Card centralizado com colunas lado a lado |
| **Interações** | Swipe para concluir tarefa | Botão de checkbox explícito |

## 3. Diretrizes Específicas por Feature

### A. Criação de Tarefas Inteligentes
* **Mobile:** O usuário está na rua ou ocupado. O *Bottom Sheet* deve ser rápido. O foco é digitar ou ditar.
* **Desktop:** O usuário está trabalhando. O Modal pode permitir uma visualização maior do "plano" que a IA gerou, permitindo edições rápidas no título das subtarefas antes de salvar.

### B. Agenda e Calendário
* **Mobile:** Visão de "Agenda do Dia" (Timeline vertical). O foco é o *agora*.
* **Desktop:** Aproveite a largura para exibir a "Visão Semanal". Como o MenteLeve foca em redução de carga, a agenda semanal no desktop serve para evitar a surpresa do "amanhã" e permitir o planejamento antecipado.

### C. Paywall Premium
* **Consistência:** O Paywall deve ser uma das poucas telas que se mantém quase idêntica em ambos. O apelo emocional ("Zere sua sobrecarga") funciona melhor em tela cheia, sem distrações. Use o espaço do desktop para mostrar, talvez, uma *preview* de como a agenda do parceiro se integra (ex: ícones ou cards de exemplo).

## 4. Estratégias de PWA para MenteLeve

1.  **Gesto vs. Mouse:**
    * Mobile: Use *Swipe* para deletar ou concluir tarefa.
    * Desktop: Adicione ícones de ação visíveis (trash/check) ao passar o mouse (*hover*), mas mantenha-os discretos (tons de *Cherry Rose*).

2.  **Otimização de Espaço:**
    * Não crie uma colcha de retalhos de informações no Desktop. Se o usuário estiver no desktop, ele provavelmente quer organizar a semana. Use o espaço extra para **planejamento de longo prazo**, não para mais botões.

3.  **Toque e Precisão:**
    * Assegure-se de que os botões (como o FAB "Adicionar") não fiquem "flutuando" no meio do nada no Desktop. Ancore-o no canto inferior direito, mesmo em telas grandes, para manter a memória muscular do usuário que alterna entre celular e PC.

---
*Lembre-se: O MenteLeve é um "spa mental". Se o design no desktop parecer um cockpit de avião, estamos falhando na proposta de valor.*
