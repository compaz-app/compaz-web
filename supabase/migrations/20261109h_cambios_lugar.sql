-- Cambio de quién estará en el lugar DESPUÉS de que el compita aceptó (regla de seguridad del compita):
-- si el cliente agrega o quita a alguien de la lista de un lugar privado, el compita se entera de inmediato y decide
-- "Sigo con la visita" o "Prefiero no ir". Esta tabla lleva cada cambio, su respuesta y cuándo escalar al equipo.
-- SOLO AGREGA una tabla nueva. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

create table if not exists public.cambios_lugar (
  id            uuid primary key default gen_random_uuid(),
  visita_id     uuid not null references public.visitas(id) on delete cascade,
  compita_id    uuid not null references public.compitas(id) on delete cascade,
  cliente_id    uuid not null references public.usuarios(id) on delete cascade,
  antes         jsonb,                       -- lista anterior (tipos de persona); null si no era un lugar privado
  despues       jsonb not null,              -- lista nueva ([] = nadie más)
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'sigue', 'no_va', 'sustituido')),
  creado_en     timestamptz not null default now(),
  respondido_en timestamptz,
  vence_en      timestamptz not null,        -- desde aquí, sin respuesta, se abre la tarea "Cambio en el lugar"
  escalado_en   timestamptz                  -- cuándo se abrió esa tarea (una sola vez)
);

-- Un solo cambio pendiente por visita: uno nuevo sustituye al anterior.
create unique index if not exists cambios_lugar_uno_pendiente on public.cambios_lugar (visita_id) where estado = 'pendiente';
create index if not exists cambios_lugar_vencen_idx on public.cambios_lugar (vence_en) where estado = 'pendiente' and escalado_en is null;

alter table public.cambios_lugar enable row level security;
revoke all on public.cambios_lugar from anon, authenticated;
-- Sin políticas: solo el servidor (service_role) toca esta tabla.
grant all on public.cambios_lugar to service_role;
notify pgrst, 'reload schema';
