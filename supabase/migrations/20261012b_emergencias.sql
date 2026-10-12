-- Permite al admin leer admin_flags vía browser client (realtime incluido).
-- Depende de is_admin() creada en 20261012_admin_rls.sql.

-- Lectura de flags para admins autenticados
drop policy if exists "admin_flags_admin_read" on public.admin_flags;
create policy "admin_flags_admin_read" on public.admin_flags
  for select using (public.is_admin());

-- Activar admin_flags en la publicación de realtime (si no está ya)
-- Ejecutar en SQL Editor:
alter publication supabase_realtime add table public.admin_flags;
