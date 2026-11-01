-- Tabla existente de la operación que usa la captación (latidos de cron y avisos de una sola vez).
-- Estructura IGUAL a la de producción a 1-nov-2026 (comprobada en compaz-platform), es decir,
-- SIN updated_at, aunque docs/schema.sql la incluya. Así las pruebas ejercitan el estado real;
-- la columna la añade supabase/migrations/20261101_telegram_estados_updated_at.sql.
create table if not exists telegram_estados (
  chat_id              text primary key,
  registro_pendiente   boolean not null default false,
  pendiente_accion     text,
  pendiente_expira     timestamptz
);
alter table telegram_estados enable row level security;
