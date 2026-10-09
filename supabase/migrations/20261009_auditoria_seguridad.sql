-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz: migración de la auditoría (2026-10-09)
-- REVISAR antes de ejecutar en el SQL Editor de Supabase. Cada bloque es independiente e idempotente.
-- Recomendado: probar primero en un proyecto de staging.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Fotos legadas que contienen el token del bot de Telegram: neutralizarlas (el token ya debe estar rotado).
update public.mensajes
   set tipo = 'texto', contenido = '[foto no disponible]'
 where tipo = 'foto' and contenido like '%/file/bot%';

-- 2) Integridad de datos que antes solo protegía el código
-- 2a) Una sola visita en curso por compita (doble toque en "Iniciar visita")
create unique index if not exists visitas_una_en_curso_por_compita
  on public.visitas (compita_id) where estado = 'en_curso';

-- 2b) Una sola solicitud pendiente por cliente y compita (carrera en crearSolicitud)
create unique index if not exists solicitudes_una_pendiente_por_par
  on public.solicitudes (cliente_id, compita_id) where estado = 'pendiente';

-- 2c) Un solo reporte de bienestar por visita (doble toque / reintento de Telegram)
create unique index if not exists reportes_visita_unico_por_visita
  on public.reportes_visita (visita_id);

-- 2d) El código escribe estado = 'bloqueado'; el CHECK original solo admitía activo/inactivo
alter table public.compitas drop constraint if exists compitas_estado_check;
alter table public.compitas add constraint compitas_estado_check
  check (estado in ('activo', 'inactivo', 'bloqueado'));

-- 3) RLS: usuarios solo pueden editar datos de su perfil; plan, compita_id y email los controla el servidor
drop policy if exists "usuarios_self" on public.usuarios;
drop policy if exists "usuarios_own_read" on public.usuarios;
drop policy if exists "usuarios_own_update" on public.usuarios;

create policy "usuarios_own_read" on public.usuarios
  for select using (auth.uid() = id);
create policy "usuarios_own_update" on public.usuarios
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.proteger_columnas_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service_role (rutas API del servidor) puede cambiar todo; un usuario autenticado, no
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.plan is distinct from old.plan
    or new.compita_id is distinct from old.compita_id
    or new.email is distinct from old.email
    or new.id is distinct from old.id
  ) then
    raise exception 'No puedes modificar plan, compita_id ni email';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_columnas_usuario on public.usuarios;
create trigger proteger_columnas_usuario
  before update on public.usuarios
  for each row execute function public.proteger_columnas_usuario();

-- 4) RLS: compitas. Visibles solo las activas y verificadas, y SIN columnas privadas
--    (email, telegram_chat_id, codigo). Los accesos con service_role no se ven afectados.
drop policy if exists "compitas_public_read" on public.compitas;
create policy "compitas_public_read" on public.compitas
  for select using (estado = 'activo' and verificado = true);

revoke select on public.compitas from anon, authenticated;
grant select (id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url,
              visitas_realizadas, rating_promedio, total_ratings, horarios_disponibles, fecha_ingreso, created_at)
  on public.compitas to anon, authenticated;

-- 5) RLS: mensajes. El cliente no debe ver los marcadores internos (origen = 'admin')
drop policy if exists "mensajes_own_read" on public.mensajes;
drop policy if exists "mensajes_via_visita" on public.mensajes;
create policy "mensajes_via_visita" on public.mensajes
  for select using (
    origen <> 'admin' and exists (
      select 1 from public.visitas v where v.id = visit_id and v.usuario_id = auth.uid()
    )
  );

-- 6) Visitas: el cliente solo lee las suyas; toda escritura pasa por el servidor
drop policy if exists "visitas_no_insert" on public.visitas;
drop policy if exists "visitas_no_update" on public.visitas;
drop policy if exists "visitas_no_delete" on public.visitas;
create policy "visitas_no_insert" on public.visitas for insert to authenticated with check (false);
create policy "visitas_no_update" on public.visitas for update to authenticated using (false);
create policy "visitas_no_delete" on public.visitas for delete to authenticated using (false);

-- 7) Tablas internas: sin acceso para anon/authenticated (RLS activo y sin políticas = denegado)
alter table public.telegram_estados enable row level security;
alter table public.admin_flags enable row level security;
alter table public.compita_edit_tokens enable row level security;
alter table public.onboarding_tokens enable row level security;
alter table public.action_tokens enable row level security;

-- 8) Realtime: ya NO se suscribe a `compitas` desde el navegador. Si existe en la publicación, quitarla:
-- alter publication supabase_realtime drop table public.compitas;
