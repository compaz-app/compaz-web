-- Políticas RLS para que el admin pueda leer mensajes y visitas en tiempo real.
-- El admin se identifica porque su email existe en auth.users con ese email
-- Y está en la tabla admin_emails que manejamos aquí.
-- Usamos una tabla pequeña en lugar de una función para evitar env vars en SQL.

-- ── Tabla de emails de admin ────────────────────────────────────────────────
create table if not exists public.admin_emails (
  email text primary key
);
-- Solo service_role puede modificarla
alter table public.admin_emails enable row level security;
create policy "admin_emails_read" on public.admin_emails for select using (true);

-- Función helper: devuelve true si el usuario autenticado es admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.admin_emails ae
    join auth.users au on lower(au.email) = lower(ae.email)
    where au.id = auth.uid()
  )
$$;

-- ── Política: admin lee todos los mensajes (incluidos los de origen='admin') ─
drop policy if exists "mensajes_admin_read" on public.mensajes;
create policy "mensajes_admin_read" on public.mensajes
  for select using (public.is_admin());

-- ── Política: admin lee todas las visitas ────────────────────────────────────
drop policy if exists "visitas_admin_read" on public.visitas;
create policy "visitas_admin_read" on public.visitas
  for select using (public.is_admin());

-- Poblar admin_emails con los emails actuales (ajusta si cambian)
-- Ejecutar UNA vez; luego mantener manualmente si se agregan admins.
insert into public.admin_emails (email)
values
  ('juantenreiro@gmail.com'),
  ('menro.ca@gmail.com'),
  ('soycompaz@gmail.com')
on conflict do nothing;
