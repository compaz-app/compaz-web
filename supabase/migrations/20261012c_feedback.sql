-- Comentario privado del cliente (feedback interno para Compaz)
alter table public.visitas
  add column if not exists comentario_cliente text;

-- Reseñas públicas que aparecen en el perfil del compita
create table if not exists public.resenas (
  id           uuid primary key default uuid_generate_v4(),
  visita_id    uuid not null unique references public.visitas(id) on delete cascade,
  compita_id   uuid not null references public.compitas(id) on delete cascade,
  cliente_id   uuid not null references public.usuarios(id) on delete cascade,
  texto        text not null,
  estrellas    smallint not null check (estrellas between 1 and 5),
  publicada    boolean not null default false,  -- admin la aprueba antes de mostrarla
  created_at   timestamptz not null default now()
);

alter table public.resenas enable row level security;

-- Lectura pública: solo reseñas aprobadas
create policy "resenas_public_read" on public.resenas
  for select using (publicada = true);

-- Admin lee todas
create policy "resenas_admin_read" on public.resenas
  for select using (public.is_admin());

-- Admin actualiza (para publicar/ocultar)
create policy "resenas_admin_update" on public.resenas
  for update using (public.is_admin());
