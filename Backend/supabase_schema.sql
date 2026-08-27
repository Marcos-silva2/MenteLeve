-- Schema Postgres para o Supabase — MenteLeve
-- Gerado a partir de Backend/app/models.py (SQLAlchemy)
-- Como usar: cole este script no SQL Editor do Supabase e execute (Run).
-- É idempotente (IF NOT EXISTS) — pode rodar de novo sem erro se as tabelas já existirem.

create table if not exists users (
    id            bigint generated always as identity primary key,
    email         varchar(255) not null unique,
    name          varchar(120) not null default 'Você',
    is_premium    boolean not null default false,
    created_at    timestamptz not null default now()
);

create index if not exists ix_users_email on users (email);

create table if not exists tasks (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references users (id) on delete cascade,
    -- Subtarefa: aponta para a tarefa-mãe (NULL = tarefa principal).
    parent_id     bigint references tasks (id) on delete cascade,
    title         varchar(500) not null,
    -- Categoria do design system: casa | filhos | trabalho | saude | financas | relacionamento
    category      varchar(40) not null default 'casa',
    -- MVP: prazo em texto livre ("Hoje", "14:00", "Amanhã • 10:00").
    due           varchar(120) not null default '',
    done          boolean not null default false,
    important     boolean not null default false,
    created_at    timestamptz not null default now()
);

create index if not exists ix_tasks_user_id on tasks (user_id);
create index if not exists ix_tasks_parent_id on tasks (parent_id);

-- De-para de tipos (SQLite -> Postgres):
--   INTEGER (PK, autoincrement) -> bigint generated always as identity
--   VARCHAR(n)                  -> varchar(n)                (mantido igual)
--   BOOLEAN                     -> boolean                   (SQLite guarda como 0/1; Postgres é nativo)
--   DATETIME (naive/UTC)        -> timestamptz                (Postgres é mais rigoroso: exige TZ explícito)
--   FOREIGN KEY ... ON DELETE CASCADE -> igual, sintaxe compatível
