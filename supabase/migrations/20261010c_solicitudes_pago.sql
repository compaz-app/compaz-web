-- Solicitudes de pago iniciadas por el cliente desde su dashboard ("quiero pagar este plan").
-- El admin las confirma cuando llega el dinero (Zelle o transferencia) y entonces se crea el pago real.
create table if not exists public.solicitudes_pago (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null check (tipo in ('plan', 'extra')),
  plan        text check (plan in ('carta', 'quincenal', 'semanal')),
  horas       integer check (horas is null or horas >= 2),
  monto_usd   numeric(10,2) not null check (monto_usd >= 0),
  metodo      text not null check (metodo in ('zelle', 'transferencia')),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'cancelado')),
  pago_id     uuid,
  created_at  timestamptz not null default now(),
  resuelta_at timestamptz
);
-- Una sola solicitud pendiente por cliente
create unique index if not exists solicitudes_pago_una_pendiente on public.solicitudes_pago (usuario_id) where estado = 'pendiente';
alter table public.solicitudes_pago enable row level security;
-- El servidor (service_role) necesita permiso explícito en tablas creadas a mano
grant all on table public.solicitudes_pago to service_role;
notify pgrst, 'reload schema';
