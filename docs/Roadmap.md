Roadmap de Migração e Sprints: MenteLeve

## 🤖 Análise de Viabilidade Técnica (IA Revisora)
**Veredito:** A migração é 100% viável e perfeitamente adequada para ser mantida de forma totalmente gratuita usando as cotas iniciais (Free Tier) dos serviços propostos.

**Contexto real do projeto** (confirmado no código): Frontend em **HTML + JS Vanilla (ES Modules) + Tailwind via CDN**, sem framework nem build step; Backend em **FastAPI (Python) + SQLAlchemy 2.0**, hoje com SQLite. Isso muda alguns detalhes técnicos do plano original abaixo.

**Justificativa Técnica:**
1. **Frontend na Vercel:** o plano *Hobby* funciona muito bem também para sites estáticos sem build (não só React/Vue/Next.js) — basta apontar o *Root Directory* para `Frontend/`. Largura de banda generosa, CI/CD direto do repositório e hospedagem sem custo.
2. **Banco de Dados no Supabase:** o plano gratuito do Supabase é um dos mais robustos do mercado. Fornece um banco PostgreSQL dedicado (500MB), sistema de Autenticação (até 50.000 usuários ativos/mês) e APIs instantâneas.
3. **De SQLite para Postgres:** evolução natural e recomendada. O schema atual é pequeno (2 tabelas: `users` e `tasks`), então a adaptação de DDL é simples. Como o backend já usa SQLAlchemy 2.0 com `DATABASE_URL` configurável via `.env`, a troca é, no código, basicamente apontar a connection string para o Postgres do Supabase e adicionar o driver `psycopg`.
4. **Backend continua não sendo hospedado na Vercel:** a Vercel serve muito bem o Frontend estático, mas **não roda um servidor FastAPI/Uvicorn persistente** — o modelo dela é serverless/edge. O Backend **permanece no Render** (ver seção "Hospedagem do Backend" abaixo — decisão: manter Render + ping externo).

---

## 🗺️ Roadmap de Migração

### Fase 1: Planejamento e Infraestrutura em Nuvem
- Criar a conta no Supabase e inicializar o projeto.
- Criar a conta na Vercel e conectar ao provedor de repositório (GitHub/GitLab/Bitbucket).
- Fazer o de-para (mapeamento) dos tipos de dados do SQLite para o PostgreSQL.

### Fase 2: Adaptação de Banco de Dados
- Exportar o esquema atual (tabelas e relacionamentos) do SQLite.
- Ajustar a sintaxe SQL e recriar as tabelas no Supabase (via SQL Editor).
- Realizar a carga inicial de dados (se houver dados importantes a serem migrados).

### Fase 3: Refatoração do Backend
- Remover as dependências e arquivos locais do SQLite.
- Configurar o driver Postgres do SQLAlchemy (`psycopg`) e apontar `DATABASE_URL` para a connection string do Supabase. *(O cliente `supabase-py` só é necessário se, além do Postgres, o projeto passar a usar Auth/Storage/APIs instantâneas do Supabase diretamente — não é obrigatório para a migração do banco.)*
- ⚠️ **Usar a connection string do "Session pooler", não a "Direct connection".** A conexão direta (`db.<ref>.supabase.co`) só tem registro DNS IPv6 (a menos que se pague o add-on de IPv4 do Supabase) — falha em redes/hosts sem saída IPv6, incluindo provavelmente o Render. O pooler (`aws-0-<região>.pooler.supabase.com`, usuário `postgres.<ref-do-projeto>`) é IPv4 e é o recomendado para apps de backend tradicionais.
- Isolar chaves de API e strings de conexão em variáveis de ambiente (`.env`).

### Fase 4: Frontend (Vercel) e Backend (Render + ping externo)
- Garantir que as requisições da interface conversem perfeitamente com a nova estrutura de backend.
- Subir o projeto para o repositório.
- Configurar o deploy automático do **Frontend** na Vercel (Root Directory: `Frontend/`), registrando as variáveis de ambiente necessárias no painel.
- Atualizar a `DATABASE_URL` do **Backend** no Render para apontar ao Postgres do Supabase.
- Configurar o ping externo (cron-job.org/UptimeRobot) em `/health` para evitar o cold start do Render.

---

## 🖥️ Hospedagem do Backend

Motivação: o plano free do Render "dorme" após ~15 min de inatividade, gerando *cold start* de ~30–50s na primeira requisição.

**Decisão (2026-08-27):** manter o **Render** e mitigar o cold start com um **ping externo gratuito** (cron-job.org ou UptimeRobot) batendo em `/health` a cada ~10 min. Menor esforço, sem migrar o deploy do backend. Se não for suficiente no futuro, revisitar as alternativas abaixo.

Opções gratuitas avaliadas para o FastAPI (Python), caso seja preciso trocar depois:

| Opção | Cold start | Sempre ativo? | Esforço de setup | Observação |
|---|---|---|---|---|
| **Manter Render + ping externo** ✅ (escolhido) | Evita o cold start na prática | Sim, via ping | Baixo (sem migrar nada) | Cron gratuito (ex.: cron-job.org, UptimeRobot) batendo em `/health` a cada ~10 min |
| Google Cloud Run | ~1–3s | Não (escala a zero, mas acorda rápido) | Médio (Dockerfile + `gcloud`) | Free tier generoso (2M requisições/mês); precisa cartão cadastrado, mas não cobra dentro da cota |
| Oracle Cloud "Always Free" (VM) | Nenhum (é uma VM real) | Sim | Alto (administrar servidor: systemd, nginx, TLS) | Genuinamente grátis "para sempre", mas exige mais DevOps |
| Fly.io | ~1–3s | Não | Médio | Free allowance reduzida desde 2024; pode exigir cartão |

---

## 🏃‍♂️ Sprints de Execução

Recomenda-se ciclos curtos (1 semana por Sprint) focados em entregas incrementais.

### Sprint 1: Setup e Migração do Banco de Dados
- **Objetivo:** Ter a infraestrutura de dados rodando na nuvem com o novo esquema.
- **Tarefas:**
  - [x] Criar projeto no Supabase e resgatar as chaves (URL e *anon key*).
  - [x] Traduzir o esquema de tabelas (`users`, `tasks`) de SQLite para Postgres — [Backend/supabase_schema.sql](../Backend/supabase_schema.sql).
  - [x] Executar o script de criação no SQL Editor do Supabase.
  - [x] Validar se as chaves estrangeiras (Foreign Keys) e restrições (Constraints) estão corretas — confirmado via teste de CRUD (delete em cascata funcionando).

### Sprint 2: Conexão e Refatoração do Backend
- **Objetivo:** A aplicação deve ler e gravar dados com sucesso no Supabase ao rodar localmente.
- **Tarefas:**
  - [x] Instalar as bibliotecas do Supabase ou driver do Postgres no projeto — `psycopg[binary]` em [requirements.txt](../Backend/requirements.txt).
  - [x] Substituir todas as antigas requisições/queries locais feitas no SQLite pelas novas chamadas ao Postgres — corrigido bug de cascade delete que dependia do comportamento (não confiável) do SQLite; ver `database.py`/`crud.py`.
  - [ ] Refatorar lógicas de autenticação (caso deseje aproveitar o Supabase Auth para maior segurança) — **adiado, fora do escopo do MVP por ora.**
  - [x] Realizar testes de CRUD (Criar, Ler, Atualizar, Deletar) no ambiente de desenvolvimento local — testado direto contra o Supabase (create/read/update/delete + subtarefa + cascade), sem deixar dados residuais.

### Sprint 3: Deploy e Homologação
- **Objetivo:** Frontend e Backend disponíveis online e funcionando ponta a ponta.
- **Tarefas:**
  - [ ] Atualizar a `DATABASE_URL` no painel do Render para a connection string do Supabase e reiniciar o serviço.
  - [ ] Criar projeto na Vercel conectando ao repositório do código (Root Directory: `Frontend/`).
  - [ ] Atualizar o `API_BASE` do Frontend ([api.js](../Frontend/js/api.js)) caso a URL do Render mude.
  - [ ] Configurar `CORS_ORIGINS` no Backend para aceitar o domínio da Vercel.
  - [ ] Cadastrar o ping externo (cron-job.org/UptimeRobot) apontando para `/health` do Render.
  - [ ] Disparar o deploy inicial (Frontend e Backend).
  - [ ] Testar o fluxo completo de uso através do link gerado (ex: `menteleve.vercel.app` ou similar).
  - [ ] Corrigir eventuais *bugs* de permissão de acesso (Policies) no banco de dados do Supabase.