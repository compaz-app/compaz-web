-- Tabla existente de la operación que usa la captación (latidos de cron y avisos de una sola vez).
-- Copia exacta de docs/schema.sql; solo para el Supabase local de CI.
create table if not exists telegram_estados (
  chat_id              text primary key,
  registro_pendiente   boolean not null default false,
  pendiente_accion     text,
  pendiente_expira     timestamptz,
  updated_at           timestamptz not null default now()
);
alter table telegram_estados enable row level security;
