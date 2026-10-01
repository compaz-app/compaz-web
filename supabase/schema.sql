-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz Platform — Schema SQL
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla: zonas ─────────────────────────────────────────────────────────────
create table if not exists public.zonas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  activa      boolean default false,
  created_at  timestamptz default now()
);

-- ── Tabla: compitas ──────────────────────────────────────────────────────────
create table if not exists public.compitas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  telegram_chat_id    text unique,
  zona                text not null,
  estado              text default 'activo' check (estado in ('activo', 'inactivo')),
  verificado          boolean default false,
  fecha_ingreso       date default current_date,
  visitas_realizadas  integer default 0,
  foto_url            text,
  descripcion         text,
  servicios           text[],
  youtube_url         text,
  created_at          timestamptz default now()
);

-- ── Tabla: usuarios ──────────────────────────────────────────────────────────
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text unique not null,
  zona        text,
  plan        text,
  compita_id  uuid references public.compitas(id),
  created_at  timestamptz default now()
);

-- ── Tabla: visitas ────────────────────────────────────────────────────────────
create table if not exists public.visitas (
  id          uuid primary key default gen_random_uuid(),
  compita_id  uuid references public.compitas(id) on delete restrict,
  usuario_id  uuid references public.usuarios(id) on delete restrict,
  estado      text default 'programada' check (estado in ('programada', 'en_curso', 'terminada')),
  inicio      timestamptz,
  fin         timestamptz,
  created_at  timestamptz default now()
);

-- ── Tabla: mensajes ───────────────────────────────────────────────────────────
create table if not exists public.mensajes (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid references public.visitas(id) on delete cascade,
  origen      text not null check (origen in ('compita', 'cliente', 'admin')),
  tipo        text default 'texto' check (tipo in ('texto', 'foto')),
  contenido   text,
  created_at  timestamptz default now()
);

-- ── Tabla: onboarding_tokens ─────────────────────────────────────────────────
create table if not exists public.onboarding_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  expires_at  timestamptz not null,
  usado       boolean default false,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.zonas        enable row level security;
alter table public.compitas     enable row level security;
alter table public.usuarios     enable row level security;
alter table public.visitas      enable row level security;
alter table public.mensajes     enable row level security;

-- zonas: lectura pública (para el mapa)
create policy "zonas_public_read" on public.zonas
  for select using (true);

-- compitas: lectura pública (para listado de Compitas)
create policy "compitas_public_read" on public.compitas
  for select using (estado = 'activo');

-- usuarios: solo el propio usuario puede leer/editar su fila
create policy "usuarios_own_read" on public.usuarios
  for select using (auth.uid() = id);

create policy "usuarios_own_update" on public.usuarios
  for update using (auth.uid() = id);

-- visitas: el cliente ve solo sus visitas
create policy "visitas_own_read" on public.visitas
  for select using (
    usuario_id = auth.uid()
  );

-- mensajes: el cliente ve solo los mensajes de sus visitas
create policy "mensajes_own_read" on public.mensajes
  for select using (
    visit_id in (
      select id from public.visitas where usuario_id = auth.uid()
    )
  );

-- el cliente puede insertar mensajes en sus visitas activas
create policy "mensajes_own_insert" on public.mensajes
  for insert with check (
    origen = 'cliente' and
    visit_id in (
      select id from public.visitas
      where usuario_id = auth.uid() and estado = 'en_curso'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- Supabase Realtime — activar en tabla mensajes
-- ══════════════════════════════════════════════════════════════════════════════

-- Ejecutar esto por separado en el SQL Editor:
-- alter publication supabase_realtime add table public.mensajes;

-- ══════════════════════════════════════════════════════════════════════════════
-- Trigger: crear fila en usuarios cuando alguien hace signup con magic link
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
