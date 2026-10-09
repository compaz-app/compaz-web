-- Una cuenta bloqueada tampoco puede leer por la API directa de Supabase (chat en tiempo real, visitas).
-- El bloqueo principal lo aplica el servidor en cada petición; esto cierra la ventana de la llave vigente (hasta 1 h).
drop policy if exists "mensajes_via_visita" on public.mensajes;
create policy "mensajes_via_visita" on public.mensajes
  for select using (
    origen <> 'admin'
    and exists (select 1 from public.visitas v where v.id = visit_id and v.usuario_id = auth.uid())
    and not exists (select 1 from public.usuarios u where u.id = auth.uid() and u.plan = 'bloqueado')
  );

drop policy if exists "visitas_cliente" on public.visitas;
drop policy if exists "visitas_own_read" on public.visitas;
create policy "visitas_cliente" on public.visitas
  for select using (
    auth.uid() = usuario_id
    and not exists (select 1 from public.usuarios u where u.id = auth.uid() and u.plan = 'bloqueado')
  );
