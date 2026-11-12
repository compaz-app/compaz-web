-- Índices de la tabla avisos para las consultas de la escalera y de la limpieza (rendimiento).
-- Solo AGREGA índices: no cambia ni borra nada. Seguro de repetir (if not exists). Ejecutar en el SQL Editor de Supabase.
-- La escalera corre cada 5 minutos y la limpieza una vez al día; sin estos índices cada corrida recorre toda la tabla
-- y el costo crece con el número de avisos.

-- La escalera pregunta "¿este aviso ya tiene un respaldo?" una vez por aviso vencido.
create index if not exists avisos_respaldo_idx
  on public.avisos (respaldo_de) where respaldo_de is not null;

-- La escalera reintenta los avisos fallidos que llevan unos minutos esperando.
create index if not exists avisos_fallidos_idx
  on public.avisos (ultimo_intento_en) where estado = 'fallido';

-- La limpieza diaria borra los avisos terminados de más de 90 días.
create index if not exists avisos_creado_idx
  on public.avisos (creado_en);
