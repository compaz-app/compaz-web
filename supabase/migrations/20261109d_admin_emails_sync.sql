-- Una sola lista de administradores: la variable ADMIN_EMAILS manda y el servidor copia esa lista a
-- public.admin_emails (la que usa is_admin() para el tiempo real). Ver lib/admins.ts y docs/plan-construccion.md.
-- Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

-- 1) El servidor necesita leer, agregar y quitar filas de esa tabla para mantenerla igual a ADMIN_EMAILS.
grant select, insert, delete on public.admin_emails to service_role;

-- 2) La política anterior dejaba leer la lista de administradores a cualquiera con permiso de lectura sobre la tabla.
--    Ahora solo la leen los propios administradores (is_admin() es security definer, no depende de esta política).
drop policy if exists "admin_emails_read" on public.admin_emails;
create policy "admin_emails_read" on public.admin_emails
  for select using (public.is_admin());
