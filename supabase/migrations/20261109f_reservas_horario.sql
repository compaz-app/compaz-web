-- Lote 3 (agenda): reservas de horario. Cuando el cliente elige una hora libre del compita, esa hora queda RESERVADA
-- hasta que el compita la confirme o la rechace (o venza). Dos clientes nunca pueden tener la misma hora del mismo compita:
-- lo garantiza la base con un índice único, no solo el código.
-- SOLO AGREGA una tabla nueva. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

create table if not exists public.reservas_horario (
  id           uuid primary key default gen_random_uuid(),
  compita_id   uuid not null references public.compitas(id) on delete cascade,
  cliente_id   uuid not null references public.usuarios(id) on delete cascade,
  solicitud_id uuid references public.solicitudes(id) on delete cascade,
  inicio       timestamptz not null,
  fin          timestamptz not null,
  estado       text not null default 'reservada' check (estado in ('reservada', 'confirmada', 'rechazada', 'liberada', 'vencida')),
  vence_en     timestamptz not null,
  creada_en    timestamptz not null default now(),
  resuelta_en  timestamptz,
  check (fin > inicio)
);

-- Una hora de un compita solo puede estar tomada una vez (mientras la reserva esté viva).
create unique index if not exists reservas_horario_hora_unica
  on public.reservas_horario (compita_id, inicio) where estado in ('reservada', 'confirmada');
-- Una solicitud tiene a lo sumo una reserva viva a la vez.
create unique index if not exists reservas_horario_una_por_solicitud
  on public.reservas_horario (solicitud_id) where solicitud_id is not null and estado in ('reservada', 'confirmada');
-- Para encontrar rápido las que vencen.
create index if not exists reservas_horario_vencen_idx on public.reservas_horario (vence_en) where estado = 'reservada';

alter table public.reservas_horario enable row level security;
revoke all on public.reservas_horario from anon, authenticated;
-- Sin políticas: solo el servidor (service_role) toca esta tabla.
grant all on public.reservas_horario to service_role;
notify pgrst, 'reload schema';
