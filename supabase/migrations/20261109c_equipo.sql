-- Equipo del panel: colaboradores con permisos que decide el administrador. Ver docs/construccion-real.md sección 6.
-- SOLO AGREGA tablas. No cambia ni borra nada existente. Seguro de repetir.
-- El administrador raíz NO vive aquí: sale de la variable ADMIN_EMAILS y no se puede quitar desde el panel.
-- Sin políticas RLS a propósito: anon y usuarios autenticados no ven nada; solo el servidor (service_role).

create table if not exists public.equipo (
  id             uuid primary key default gen_random_uuid(),
  correo         text not null unique check (correo = lower(correo)),
  nombre         text not null,
  -- Solo guarda lo que está ACTIVADO. Lo que falte cuenta como apagado (negar por defecto).
  permisos       jsonb not null default '{}'::jsonb,
  activo         boolean not null default true,
  creado_por     text not null,
  creado_en      timestamptz not null default now(),
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

-- Historial de cada cambio del equipo (alta, permisos, baja). Solo inserción.
create table if not exists public.equipo_historial (
  id          bigint generated always as identity primary key,
  correo      text not null,
  accion      text not null,
  detalle     jsonb not null default '{}'::jsonb,
  hecho_por   text not null,
  hecho_en    timestamptz not null default now()
);
create index if not exists equipo_historial_correo_idx on public.equipo_historial (correo, hecho_en desc);

create or replace function public.equipo_historial_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'equipo_historial es de solo inserción' using errcode = '42501';
end $$;

drop trigger if exists equipo_historial_sin_cambios on public.equipo_historial;
create trigger equipo_historial_sin_cambios
  before update or delete on public.equipo_historial
  for each row execute function public.equipo_historial_inmutable();

alter table public.equipo           enable row level security;
alter table public.equipo_historial enable row level security;

grant all on public.equipo           to service_role;
grant all on public.equipo_historial to service_role;
grant usage, select on all sequences in schema public to service_role;
