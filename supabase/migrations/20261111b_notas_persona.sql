-- Notas internas del equipo sobre un cliente o un compita (ficha del panel). Solo AGREGA una tabla; seguro de repetir.
-- Cada nota guarda quién la escribió y cuándo. Solo se agregan: no se editan ni se borran desde el panel, para que quede el historial.
create table if not exists public.notas_persona (
  id           uuid primary key default gen_random_uuid(),
  persona_tipo text not null check (persona_tipo in ('cliente', 'compita')),
  persona_id   uuid not null,
  texto        text not null check (char_length(texto) between 1 and 1000),
  autor        text not null,
  creado_en    timestamptz not null default now()
);
create index if not exists notas_persona_idx on public.notas_persona (persona_tipo, persona_id, creado_en desc);

alter table public.notas_persona enable row level security;
revoke all on public.notas_persona from anon, authenticated;
-- Sin políticas: solo el servidor (service_role) la toca; el panel la lee y escribe por rutas con permisos.
grant all on public.notas_persona to service_role;
notify pgrst, 'reload schema';
