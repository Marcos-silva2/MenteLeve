# 🏃 Sprint de 3 Dias: MVP MenteLeve

Como temos apenas 3 dias para lançar o MVP, precisamos ser implacáveis com o escopo. A regra de ouro aqui é: **Focar no "Aha Moment"** (A criação mágica de tarefas com IA) e deixar telas secundárias (como Configurações e Paywall completo) apenas como interfaces visuais (mockadas) por enquanto.

---

## 🛠 Arquitetura e Stack Tecnológica
* **Frontend (PWA):** HTML/CSS/JS (Vanilla) ou React.js (com Vite). Recomendado Vite + React pela agilidade na componentização.
* **Estilização:** TailwindCSS (configurado com as cores do Design System *Bordeaux Pink*).
* **Backend:** Python com **FastAPI** (rápido de escrever, autodescritivo e excelente para APIs).
* **Banco de Dados:** SQLite (embutido, sem necessidade de configurar servidor extra no MVP).
* **Inteligência Artificial:** API da Google AI Studio (versão gratuita)
* **Hospedagem:** * Front: GitHub Pages (simples e integrado).
    * Back: Render (Plano gratuito suporta FastAPI + SQLite via disco persistente).

---

## 📂 Estrutura de Repositórios Recomendada
Crie dois repositórios separados no GitHub para facilitar o deploy:
1.  `menteleve-frontend` (Vai para o GitHub Pages)
2.  `menteleve-backend` (Vai para o Render)

---

## 📅 O Plano de Batalha (Sprint de 72 Horas)

### 🔴 DIA 1: O Cérebro (Backend, Banco e IA)
**Objetivo:** Ter a API rodando, conectada ao banco e respondendo com a IA.

* **Manhã (Setup & Banco):**
    * Criar o repositório `menteleve-backend`.
    * Configurar ambiente Python (`venv`, instalar `fastapi`, `uvicorn`, `sqlalchemy`, `openai`).
    * Criar o banco SQLite com duas tabelas simples: `users` e `tasks` (id, title, user_id, is_completed, created_at).
* **Tarde (Rotas da API):**
    * Criar rota `GET /tasks/{user_id}` (Lista as tarefas do usuário).
    * Criar rota `POST /tasks/smart` (A mágica). Aqui o usuário envia um texto natural (ex: "Festa do Leo"). O backend chama a OpenAI com um prompt instruindo a quebrar isso em 3 subtarefas e salva no SQLite.
    * Criar rota `PUT /tasks/{task_id}/complete` (Marca como feita).
* **Noite (Deploy no Render):**
    * Criar um arquivo `requirements.txt` e um `Procfile` (ou script de start).
    * Conectar o repositório no Render (Web Service).
    * **Atenção:** Configurar um "Disk" no Render montado na pasta onde o arquivo `.db` do SQLite vai ficar, para não perder os dados a cada deploy.

### 🟡 DIA 2: O Corpo (Frontend e PWA)
**Objetivo:** Construir as telas principais e conectar com a API que já está no ar.

* **Manhã (Setup & Design System):**
    * Criar repositório `menteleve-frontend` com Vite (React).
    * Configurar as variáveis de cor no CSS (`--bg: #fff0f3`, `--primary: #ff4d6d`, etc).
    * Implementar a **Tela de Autenticação Rápida** (Para o MVP de 3 dias, não implemente OAuth do Google/Apple real. Peça apenas um e-mail, salve no `localStorage` e use como identificador `user_id` nas chamadas da API).
* **Tarde (A Home e o Core):**
    * Criar o componente **Dashboard (Home)**.
    * Implementar a chamada para `GET /tasks` usando `fetch` e renderizar a lista.
    * Criar o **Bottom Sheet (ou Modal)** de Nova Tarefa.
* **Noite (A Mágica da IA & PWA):**
    * Conectar o formulário de Nova Tarefa à rota `POST /tasks/smart`.
    * Implementar o "Pop-up da IA" quando a API retornar as tarefas sugeridas.
    * Transformar em PWA: Adicionar o arquivo `manifest.json` (ícones, nome, `display: standalone`, `theme_color: #fff0f3`) e um Service Worker básico para permitir a instalação no celular.

### 🟢 DIA 3: A Alma (Polimento, Telas Secundárias e Deploy Front)
**Objetivo:** Fechar os buracos, adicionar as micro-interações e colocar na mão dos usuários.

* **Manhã (Onboarding e Fluxo):**
    * Montar o Carrossel de Onboarding (Telas 1, 2 e 3). Salvar uma flag no `localStorage` (ex: `onboarding_visto = true`) para nunca mais mostrar após a primeira vez.
    * Adicionar as animações: o *fade-out* ao concluir uma tarefa (Checkbox) e o botão vibrante de "Adicionar" (FAB).
* **Tarde (Telas Fantasmas - "Fake it till you make it"):**
    * Como não dá tempo de codificar o sistema de calendário complexo ou o convite real de parceiros em 3 dias:
    * Criar a **Tela de Conexões** e a **Tela de Paywall** de forma *estática*. O visual deve estar perfeito (como geramos nas imagens), mas os botões apenas mostram um toast dizendo *"Recurso disponível na versão final"*. Isso serve para testar o interesse (conversão) dos primeiros usuários.
* **Noite (Deploy & QA):**
    * Configurar o GitHub Pages no repositório do frontend (usar `gh-pages` branch ou Actions).
    * Testar o fluxo completo pelo celular (Instalar o PWA -> Onboarding -> Digitar tarefa -> Ver IA responder -> Concluir tarefa).
    * Comemorar e abrir uma cerveja/suco. O MVP está no ar!

---

## 🎯 Resumo de Sobrevivência para os 3 Dias
1. **Não perca tempo com Login complexo:** Use `localStorage` com um e-mail simples para simular o usuário.
2. **Deixe o SQLite no Render persistente:** Lembre-se do "Disk" nas configurações do Render.
3. **Foque no Prompt da IA:** O sucesso do app no dia 1 de uso depende de quão bem a IA quebra a tarefa. Gaste um bom tempo escrevendo um *System Prompt* excelente no backend Python.
