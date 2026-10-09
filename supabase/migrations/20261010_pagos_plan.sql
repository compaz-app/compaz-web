-- Pagos y créditos de visitas. Cada pago (plan mensual o visita extra) es un paquete que vence a los 60 días.
-- Ejecutar ANTES del deploy que incluye "Registrar pago". El código es tolerante: si la tabla no existe,
-- usa el cupo antiguo por plan_contratado/plan_inicio.
create table if not exists public.pagos_plan (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  tipo          text not null check (tipo in ('plan', 'extra')),
  plan          text check (plan in ('carta', 'quincenal', 'semanal')),
  visitas       integer not null check (visitas > 0),
  horas         integer check (horas is null or horas >= 2),
  monto_usd     numeric(10,2) not null check (monto_usd >= 0),
  metodo        text not null check (metodo in ('zelle', 'transferencia', 'stripe', 'otro')),
  referencia    text,
  registrado_por text,
  estado        text not null default 'activo' check (estado in ('activo', 'anulado')),
  anulado_motivo text,
  inicio        timestamptz not null default now(),
  vence         timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists pagos_plan_usuario_idx on public.pagos_plan (usuario_id, vence);

-- Solo el servidor (service_role) accede: RLS activo y sin políticas = denegado a anon/authenticated.
alter table public.pagos_plan enable row level security;
