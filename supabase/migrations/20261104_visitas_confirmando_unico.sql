-- La visita pasa por 'confirmando_inicio' (el compita llegó y el cliente aún no confirma). Los índices únicos
-- originales (20261009) no incluían ese estado: un cliente podía tener dos visitas activas y un compita dos
-- arranques a la vez durante esos minutos. Solo AGREGA índices nuevos; no toca los existentes. Seguro de repetir.
-- Antes de crearlos puedes comprobar que no hay duplicados (no debería devolver filas):
--   select usuario_id, count(*) from public.visitas
--    where estado in ('pre_visita','programada','confirmando_inicio','en_curso') group by 1 having count(*) > 1;
--   select compita_id, count(*) from public.visitas
--    where estado in ('confirmando_inicio','en_curso') group by 1 having count(*) > 1;
create unique index if not exists visitas_una_activa_por_cliente_v2
  on public.visitas (usuario_id) where estado in ('pre_visita', 'programada', 'confirmando_inicio', 'en_curso');
create unique index if not exists visitas_una_iniciada_por_compita
  on public.visitas (compita_id) where estado in ('confirmando_inicio', 'en_curso');
