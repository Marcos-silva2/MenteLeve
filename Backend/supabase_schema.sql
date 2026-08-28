-- Schema Postgres para o Supabase — MenteLeve
-- Gerado a partir de Backend/app/models.py (SQLAlchemy)
-- Como usar: cole este script no SQL Editor do Supabase e execute (Run).
-- É idempotente (IF NOT EXISTS) — pode rodar de novo sem erro se as tabelas já existirem.

-- Conteúdo criptografado (AES-256-GCM, ver Backend/app/crypto.py): users.name e
-- tasks.title chegam aqui como `v1:<base64>` e são TEXT porque o base64 infla
-- ~35%. A chave (ENCRYPTION_KEY) vive só no ambiente do backend — nunca aqui.
-- Metadados (e-mail, data, categoria, status) ficam legíveis de propósito: são
-- eles que sustentam o login, o calendário e os índices.

create table if not exists users (
    id              bigint generated always as identity primary key,
    email           varchar(255) not null unique,
    name            text not null default 'Você',
    -- Hash bcrypt da senha (nunca a senha em texto puro).
    -- Nullable: contas criadas antes da autenticação real não têm senha.
    hashed_password varchar(255),
    is_premium      boolean not null default false,
    created_at      timestamptz not null default now()
);

-- Para bancos criados antes da autenticação real (idempotente):
alter table users add column if not exists hashed_password varchar(255);

create index if not exists ix_users_email on users (email);

create table if not exists tasks (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references users (id) on delete cascade,
    -- Subtarefa: aponta para a tarefa-mãe (NULL = tarefa principal).
    parent_id     bigint references tasks (id) on delete cascade,
    title         text not null,
    -- Categoria do design system: casa | filhos | trabalho | saude | financas | relacionamento
    category      varchar(40) not null default 'casa',
    -- Prazo estruturado: fonte da verdade para posicionar no calendário.
    due_date      date,
    due_time      varchar(5),   -- "HH:MM"
    -- Rótulo em texto livre ("Toda semana", "Véspera"); só fallback de exibição.
    due           varchar(120) not null default '',
    done          boolean not null default false,
    important     boolean not null default false,
    created_at    timestamptz not null default now()
);

create index if not exists ix_tasks_user_id on tasks (user_id);
create index if not exists ix_tasks_parent_id on tasks (parent_id);
create index if not exists ix_tasks_due_date on tasks (due_date);

-- Para bancos criados antes do prazo estruturado (idempotente):
alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists due_time varchar(5);

-- Para bancos criados antes da criptografia (idempotente): o ciphertext em
-- base64 não cabe no varchar original. O backend também faz isso no boot
-- (database._widen_columns), mas rodar aqui é mais previsível.
alter table tasks alter column title type text;
alter table users alter column name type text;

-- De-para de tipos (SQLite -> Postgres):
--   INTEGER (PK, autoincrement) -> bigint generated always as identity
--   VARCHAR(n)                  -> varchar(n)                (mantido igual)
--   BOOLEAN                     -> boolean                   (SQLite guarda como 0/1; Postgres é nativo)
--   DATETIME (naive/UTC)        -> timestamptz                (Postgres é mais rigoroso: exige TZ explícito)
--   FOREIGN KEY ... ON DELETE CASCADE -> igual, sintaxe compatível
