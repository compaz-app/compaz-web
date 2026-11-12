-- Corrección de la migración 20261109_lote1_cimientos.sql: faltaba dar permiso al servidor (service_role) sobre
-- las 4 tablas nuevas, igual que hizo la migración de avisos. Sin esto la clave del servidor recibe "permiso denegado".
-- Solo da permisos al servidor; anon y usuarios autenticados siguen sin acceso. Seguro de repetir.

grant all on public.ajustes           to service_role;
grant all on public.ajustes_historial to service_role;
grant all on public.cancelaciones     to service_role;
grant all on public.fotos_privadas    to service_role;
grant usage, select on all sequences in schema public to service_role;
