-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Corrección de esquema: telegram_estados.updated_at
--
-- docs/schema.sql define telegram_estados con updated_at, y el código la usa en
-- 10 sitios (latidos y vigilancia de crons, límites de solicitar-acceso,
-- reconectar-llamada y del bot de Telegram, contador de códigos fallidos,
-- limpieza diaria), pero la columna no existe en producción. Sin ella esas
-- escrituras fallan en silencio (PostgREST devuelve error y el código no lo mira).
--
-- Solo añade la columna. No toca filas ni permisos: las filas existentes toman la
-- hora de la migración (valor por defecto no volátil, sin reescribir la tabla).
-- Idempotente: si la columna ya existe, no hace nada.
-- ══════════════════════════════════════════════════════════════════════════════
begin;
alter table public.telegram_estados add column if not exists updated_at timestamptz not null default now();
commit;
