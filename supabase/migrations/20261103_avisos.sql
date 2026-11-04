-- Registro de avisos (rediseño del ciclo de comunicaciones). Ver docs/esquema-avisos-eventos.md.
-- Solo AGREGA una tabla nueva: no cambia ni borra nada existente, así el código actual sigue funcionando.
-- Ejecutar en el SQL Editor de Supabase. Es seguro repetirla (if not exists).

create table if not exists public.avisos (
  id                  uuid primary key default gen_random_uuid(),

  -- A quién va. destinatario_id apunta a usuarios.id o compitas.id según el tipo, por eso no lleva
  -- clave foránea (es polimórfico). Para el admin no hay id.
  destinatario_tipo   text not null check (destinatario_tipo in ('cliente', 'compita', 'admin')),
  destinatario_id     uuid,
  canal               text not null check (canal in ('telegram', 'correo')),

  -- Qué se envía. El texto se arma al enviar a partir de la plantilla y las variables, así una
  -- corrección de copy también llega a los reintentos. Sin datos de contacto del otro lado.
  plantilla           text not null check (char_length(plantilla) <= 60),
  variables           jsonb not null default '{}'::jsonb,

  -- A qué se refiere y en qué paso del ciclo (1 a 16).
  entidad             text check (char_length(entidad) <= 50),
  entidad_id          uuid,
  paso                smallint check (paso between 1 and 16),

  -- Resultado del envío. Se mide aparte la acción de la persona (accion_en).
  estado              text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido', 'cancelado')),
  error               text check (char_length(error) <= 500),
  intentos            smallint not null default 0,
  ultimo_intento_en   timestamptz,

  -- Escalera de insistencia.
  programado_para     timestamptz not null default now(),
  plazo_accion_hasta  timestamptz,
  accion_en           timestamptz,
  respaldo_de         uuid references public.avisos (id) on delete set null,

  -- Idempotencia: el mismo hecho no se envía dos veces (ej. 'solicitud_nueva:<id>:telegram').
  clave_unica         text unique check (char_length(clave_unica) <= 200),

  creado_en           timestamptz not null default now(),

  constraint avisos_destinatario_ok check (destinatario_tipo = 'admin' or destinatario_id is not null)
);

comment on table public.avisos is
  'Cada aviso enviado a una persona, con su resultado y si actuó. Base del reintento y de la escalera de respaldo.';

create index if not exists avisos_pendientes_idx
  on public.avisos (programado_para) where estado = 'pendiente';
create index if not exists avisos_sin_accion_idx
  on public.avisos (plazo_accion_hasta)
  where estado = 'enviado' and accion_en is null and plazo_accion_hasta is not null;
create index if not exists avisos_destinatario_idx
  on public.avisos (destinatario_tipo, destinatario_id, creado_en desc);
create index if not exists avisos_entidad_idx
  on public.avisos (entidad, entidad_id);

-- Solo el servidor (clave de servicio) lee y escribe. Sin políticas para clientes ni compitas.
alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;
-- Permiso explícito: la tabla resenas quedó sin él y hoy da "permission denied" a la clave de servicio.
grant all on public.avisos to service_role;
