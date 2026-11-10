-- "No quiero volver con este cliente": el compita reporta un problema y marca no volver; el par queda bloqueado para solicitudes y
-- visitas nuevas hasta que el equipo lo levante. El cliente nunca ve el motivo. SOLO AGREGA una tabla. Seguro de repetir.

create table if not exists public.bloqueos_compita_cliente (
  id            uuid primary key default gen_random_uuid(),
  compita_id    uuid not null references public.compitas(id) on delete cascade,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  motivo        text not null check (char_length(motivo) <= 60),
  creado_en     timestamptz not null default now(),
  activo        boolean not null default true,
  levantado_por text,
  levantado_en  timestamptz
);

create unique index if not exists bloqueos_cc_par_activo
  on public.bloqueos_compita_cliente (compita_id, usuario_id) where activo;
create index if not exists bloqueos_cc_usuario_idx on public.bloqueos_compita_cliente (usuario_id) where activo;

alter table public.bloqueos_compita_cliente enable row level security;
revoke all on public.bloqueos_compita_cliente from anon, authenticated;
grant all on public.bloqueos_compita_cliente to service_role;
notify pgrst, 'reload schema';

-- Cada reporte del compita con sus respuestas de un toque y el plazo de la llamada del equipo. SOLO AGREGA una tabla.
create table if not exists public.reportes_compita (
  id             uuid primary key default gen_random_uuid(),
  compita_id     uuid not null references public.compitas(id) on delete cascade,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  motivo         text not null check (char_length(motivo) <= 60),
  cuando         text check (cuando in ('durante', 'llegada', 'despues')),
  esta_bien      boolean,
  reincidente    boolean,
  no_volver      boolean not null default false,
  llamar         boolean not null default false,
  plazo_llamada  timestamptz,
  llamada_en     timestamptz,
  llamada_por    text,
  resultado      text check (resultado in ('resuelto', 'hablar_cliente', 'mantener_bloqueo', 'levantar_bloqueo')),
  escalado_en    timestamptz,
  creado_en      timestamptz not null default now()
);
create index if not exists reportes_compita_pendientes_idx on public.reportes_compita (plazo_llamada) where llamar and llamada_en is null;
create index if not exists reportes_compita_compita_idx on public.reportes_compita (compita_id, creado_en desc);
alter table public.reportes_compita enable row level security;
revoke all on public.reportes_compita from anon, authenticated;
grant all on public.reportes_compita to service_role;
notify pgrst, 'reload schema';
