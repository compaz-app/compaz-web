-- Registro de actividad del equipo: TODO lo que antes llegaba al administrador por Telegram queda aquí, ordenado y consultable
-- en el panel. Solo lo urgente suena por Telegram; las tareas viven en la bandeja (admin_flags); lo informativo solo se registra.
-- SOLO AGREGA una tabla nueva. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

create table if not exists public.actividad_admin (
  id             uuid primary key default gen_random_uuid(),
  creado_en      timestamptz not null default now(),
  nivel          text not null check (nivel in ('actividad', 'tarea', 'urgente')),
  resumen        text not null check (char_length(resumen) <= 1200),
  categoria      text,
  entidad_tipo   text,
  entidad_id     text,
  entidad_nombre text
);

create index if not exists actividad_admin_creado_idx on public.actividad_admin (creado_en desc);
create index if not exists actividad_admin_nivel_idx on public.actividad_admin (nivel, creado_en desc);

alter table public.actividad_admin enable row level security;
revoke all on public.actividad_admin from anon, authenticated;
-- Sin políticas: solo el servidor (service_role) la toca; el panel la lee por una ruta con permisos.
grant all on public.actividad_admin to service_role;
notify pgrst, 'reload schema';
