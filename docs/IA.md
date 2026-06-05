*   **Valor para a Usuária:** Zero atrito. Ela descarrega a mente rapidamente, e a IA faz o trabalho de "Data Entry" e categorização correta.

### 2. Mapeamento de Dependências (Antecipação Preventiva)
Este é o "Aha Moment" do aplicativo e o núcleo da proposta de valor. Para cada evento ou tarefa principal criada, a IA analisa a árvore de dependências lógicas e operacionais daquela ação. 

*   **Ação:** Um novo `INSERT` ocorre na tabela de Tarefas (ex: *Consulta Pediátrica*).
*   **O papel da IA:** Um gatilho no backend envia o contexto para a IA, que avalia: *"O que é necessário preparar ANTES ou DEPOIS deste evento para que ele ocorra sem estresse?"*
*   **Exemplos de Saída (que vão para a tabela `AiSuggestions` no PostgreSQL):**
    *   *Gatilho:* "Viagem para praia dia 12" ➔ *Sugestão IA:* "Lembrar de comprar protetor solar infantil dia 10."
    *   *Gatilho:* "Pagar rematrícula da escola até dia 05" ➔ *Sugestão IA:* "Solicitar boleto atualizado à secretaria dia 02."
    *   *Gatilho:* "Festa de aniversário da sogra" ➔ *Sugestão IA:* "Encomendar o bolo com 48h de antecedência."
*   **Valor para a Usuária:** O aplicativo assume o papel de planejar os passos invisíveis da rotina, reduzindo drasticamente a carga cognitiva.

### 3. Governança de Recorrência (Identificação de Padrões)
Muitas tarefas da carga mental feminina são ciclos repetitivos não documentados. A IA ajudará a fechar essas lacunas.

*   **O papel da IA:** Avaliar o título e o contexto de uma tarefa para sugerir a automação daquele ciclo, transformando um esforço isolado em um processo gerenciado.
*   **Ação:** A usuária cria a tarefa *"Comprar fraldas e leite"*.
*   **Resultado da IA:** *"Notei que esta é uma compra de consumo contínuo. Deseja que eu crie um ciclo automático para te lembrar a cada 15 dias?"*
*   **Valor para a Usuária:** Transformar a ansiedade de "ter que lembrar" em um sistema confiável que trabalha por ela.

---

### Resumo do Fluxo Técnico da IA

1.  **Frontend:** Usuária digita o texto livre.
2.  **Edge Function (Backend):** Intercepta o texto e envia um *prompt* estruturado (com regras rígidas de saída) para o modelo (ex: GPT-4o-mini).
3.  **Processamento:** O modelo executa a extração de dados e calcula as tarefas preventivas.
4.  **Banco de Dados:** O retorno é gravado no PostgreSQL (inserindo a tarefa na tabela `Tasks` e as ideias na `AiSuggestions`).
5.  **UI:** O aplicativo exibe as sugestões de forma fluida para a usuária apenas aceitar ou recusar com um toque.

Considerando que a velocidade de resposta é crítica para que a usuária sinta essa "mágica" acontecendo em tempo real, você prefere estruturar essa chamada à IA de forma síncrona (a tela aguarda a sugestão da IA para salvar a tarefa) ou assíncrona (salva a tarefa na hora e a sugestão da IA aparece via notificação ou pop-up logo em seguida)?