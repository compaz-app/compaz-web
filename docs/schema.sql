-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz Platform — Schema completo de la base de datos
-- Supabase (PostgreSQL)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensiones ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: compitas
-- Venezolanas que ofrecen el servicio de cuidado.
-- ══════════════════════════════════════════════════════════════════════════════
create table compitas (
  id                uuid primary key default uuid_generate_v4(),
  nombre            text not null,
  telegram_chat_id  text unique,            -- ID del chat de Telegram del compita
  zona              text not null,          -- Estado/municipio donde opera
  estado            text not null default 'activo' check (estado in ('activo', 'inactivo')),
  verificado        boolean not null default false,  -- Solo verificadas aparecen en el mapa
  fecha_ingreso     date,
  visitas_realizadas integer not null default 0,
  foto_url          text,
  descripcion       text,
  servicios         text[],                 -- Ej: ['acompañamiento', 'medicamentos', 'cocina']
  youtube_url       text,
  codigo            text unique,            -- Código de invitación para el compita
  created_at        timestamptz not null default now()
);

-- El mapa y el marketplace solo muestran compitas activas y verificadas.
-- Un admin hace verificado=true para que aparezca, estado='inactivo' para ocultarla.

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- Clientes registrados en el portal.
-- ══════════════════════════════════════════════════════════════════════════════
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  zona        text,                         -- Estado/municipio donde vive su familiar
  plan        text,                         -- Reservado para planes futuros
  compita_id  uuid references compitas(id), -- Compita asignada (post-entrevista)
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: visitas
-- Registro de visitas de cuidado en tiempo real.
-- ══════════════════════════════════════════════════════════════════════════════
create table visitas (
  id          uuid primary key default uuid_generate_v4(),
  compita_id  uuid not null references compitas(id),
  usuario_id  uuid not null references usuarios(id),
  estado      text not null default 'programada'
              check (estado in ('programada', 'en_curso', 'terminada')),
  inicio      timestamptz,
  fin         timestamptz,
  room_url    text,                          -- URL de la sala Daily.co para videollamada
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: mensajes
-- Chat entre cliente y compita durante una visita.
-- ══════════════════════════════════════════════════════════════════════════════
create table mensajes (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid not null references visitas(id) on delete cascade,
  origen      text not null check (origen in ('compita', 'cliente', 'admin')),
  tipo        text not null check (tipo in ('texto', 'foto')),
  contenido   text,
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: action_tokens
-- Tokens de un solo uso para registrar el interés de un cliente en un compita.
-- Precursor del flujo de solicitudes. Mantener por compatibilidad.
-- ══════════════════════════════════════════════════════════════════════════════
create table action_tokens (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid not null references auth.users(id),
  compita_id  uuid not null references compitas(id),
  token       text not null unique,
  usado       boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Rate limit: un cliente puede tener como máximo 3 tokens activos simultáneos.

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: solicitudes
-- Solicitud formal de entrevista de un cliente a un compita.
-- Reemplaza/complementa action_tokens con más contexto.
-- ══════════════════════════════════════════════════════════════════════════════
create table solicitudes (
  id               uuid primary key default uuid_generate_v4(),
  cliente_id       uuid not null references usuarios(id),
  compita_id       uuid not null references compitas(id),
  mensaje          text not null,           -- Descripción del familiar y necesidades
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'aceptada', 'rechazada', 'completada')),
  franja_horaria   text,                    -- Horario preferido del cliente (texto libre)
  token_respuesta  uuid not null unique default uuid_generate_v4(), -- Para link de respuesta en Telegram
  created_at       timestamptz not null default now(),
  respondido_at        timestamptz,            -- Cuando el compita respondió
  slot_confirmado      timestamptz,            -- Slot de entrevista aceptado
  room_url             text,                   -- URL de sala Daily.co
  seguimiento_enviado  boolean not null default false -- Email de seguimiento post-llamada enviado
);

-- Flujo:
-- 1. Cliente crea solicitud (estado=pendiente)
-- 2. Bot envía mensaje a Telegram del compita con link de aceptar/rechazar
-- 3. Compita responde → estado=aceptada|rechazada, respondido_at=now()
-- 4. Compita acepta slot → slot_confirmado=<timestamp>, room_url=<url>
-- 5. 23 min después del slot → cron envía email de seguimiento, seguimiento_enviado=true
-- 6. Cliente confirma → estado=completada

-- Columnas añadidas por ALTER (no en CREATE inicial):
-- alter table solicitudes add column if not exists slot_confirmado timestamptz;
-- alter table solicitudes add column if not exists room_url text;
-- alter table solicitudes add column if not exists seguimiento_enviado boolean default false;

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
alter table compitas enable row level security;
alter table usuarios enable row level security;
alter table visitas enable row level security;
alter table mensajes enable row level security;
alter table action_tokens enable row level security;
alter table solicitudes enable row level security;

-- compitas: lectura pública para activas+verificadas
create policy "compitas_public_read" on compitas
  for select using (estado = 'activo' and verificado = true);

-- usuarios: solo el propio usuario ve su fila
create policy "usuarios_self" on usuarios
  for all using (auth.uid() = id);

-- visitas: cliente ve las suyas; escritura solo por service_role (las API routes usan createAdminSupabase)
create policy "visitas_cliente" on visitas
  for select using (auth.uid() = usuario_id);

-- Negar explícitamente INSERT/UPDATE/DELETE a roles autenticados (fail-closed)
create policy "visitas_no_insert" on visitas for insert to authenticated with check (false);
create policy "visitas_no_update" on visitas for update to authenticated using (false);
create policy "visitas_no_delete" on visitas for delete to authenticated using (false);

-- mensajes: acceso por visita (el cliente ve mensajes de sus visitas)
create policy "mensajes_via_visita" on mensajes
  for select using (
    exists (
      select 1 from visitas v
      where v.id = visit_id and v.usuario_id = auth.uid()
    )
  );

-- solicitudes: cliente ve las suyas
create policy "solicitudes_cliente" on solicitudes
  for select using (auth.uid() = cliente_id);

-- action_tokens: cliente ve los suyos
create policy "tokens_cliente" on action_tokens
  for select using (auth.uid() = cliente_id);

-- Nota: las operaciones de escritura admin usan la service_role key (bypassa RLS).
-- Las APIs de Next.js usan createAdminSupabase() para operaciones administrativas.
