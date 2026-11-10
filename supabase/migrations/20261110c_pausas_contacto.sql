-- Pausa de cuenta por compartir contactos: la SEGUNDA detección en 30 días pausa a la persona (cliente o compita) hasta que el equipo decida.
-- SOLO AGREGA una tabla. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

create table if not exists public.pausas_contacto (
  id            uuid primary key default gen_random_uuid(),
  rol           text not null check (rol in ('cliente', 'compita')),
  persona_id    uuid not null,
  creada_en     timestamptz not null default now(),
  activa        boolean not null default true,
  /** true si la persona ya había recibido "otra oportunidad": el equipo debería considerar bloquear. */
  reincidente   boolean not null default false,
  decision      text check (decision in ('reactivar', 'otra_oportunidad', 'bloquear')),
  decidida_por  text,
  decidida_en   timestamptz
);

-- Una sola pausa activa por persona.
create unique index if not exists pausas_contacto_una_activa on public.pausas_contacto (rol, persona_id) where activa;
create index if not exists pausas_contacto_persona_idx on public.pausas_contacto (rol, persona_id, creada_en desc);

alter table public.pausas_contacto enable row level security;
revoke all on public.pausas_contacto from anon, authenticated;
grant all on public.pausas_contacto to service_role;
notify pgrst, 'reload schema';
