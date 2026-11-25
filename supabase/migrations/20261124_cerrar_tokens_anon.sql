-- Seguridad: la tabla de invitaciones de compitas estaba abierta a cualquiera que tuviera la llave pública de Supabase (la que viaja en el navegador).
-- Tenía una política «todos pueden todo» (using true / with check true) para el rol público y permisos de tabla para el rol anónimo: cualquiera podía leer las invitaciones
-- vigentes y crearse una propia para registrarse como compita sin que el equipo lo invitara. Se comprobó leyendo la tabla como rol anónimo (2026-11-21).
-- El servidor usa la llave de servicio, que NO depende de esta política ni de estos permisos: este cambio no afecta a ninguna función del sistema. Seguro de repetir.
-- Aunque `compita_edit_tokens` ya estaba cerrada por la seguridad por filas (sin políticas), también se le quitan los permisos al rol anónimo y al autenticado: un token
-- de edición de perfil nunca debe poder pedirse desde el navegador, ni por error.

drop policy if exists service_role_full_access on public.onboarding_tokens;
revoke all on table public.onboarding_tokens from anon, authenticated;
revoke all on table public.compita_edit_tokens from anon, authenticated;
alter table public.onboarding_tokens enable row level security;
alter table public.compita_edit_tokens enable row level security;
notify pgrst, 'reload schema';
