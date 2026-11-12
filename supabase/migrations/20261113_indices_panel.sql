-- Índices para el panel del equipo (auditoría E-03). Solo AGREGA índices y una extensión: no cambia datos ni columnas y es seguro de repetir.
-- Sin ellos, cada ficha, cada detalle de visita y el Registro de accesos (que guarda un año) recorren tablas enteras.

-- Actividad: ficha y visita buscan por entidad; el Registro de accesos y los filtros buscan por categoría.
create index if not exists actividad_admin_entidad_idx on public.actividad_admin (entidad_id, creado_en desc);
create index if not exists actividad_admin_categoria_idx on public.actividad_admin (categoria, creado_en desc);

-- La búsqueda de texto de Actividad usa ilike '%texto%': con trigramas deja de recorrer toda la ventana.
create extension if not exists pg_trgm;
create index if not exists actividad_admin_resumen_trgm_idx on public.actividad_admin using gin (resumen gin_trgm_ops);

-- Lo que el portal, Seguimiento y las fichas leen por cliente o por compita (si ya existían, no pasa nada).
create index if not exists visitas_usuario_idx on public.visitas (usuario_id, created_at desc);
create index if not exists visitas_compita_idx on public.visitas (compita_id, created_at desc);
create index if not exists mensajes_visita_idx on public.mensajes (visit_id, created_at);
create index if not exists solicitudes_cliente_idx on public.solicitudes (cliente_id, created_at desc);
create index if not exists solicitudes_compita_idx on public.solicitudes (compita_id, created_at desc);
create index if not exists cancelaciones_usuario_idx on public.cancelaciones (usuario_id, creado_en desc);
create index if not exists pagos_plan_usuario_idx on public.pagos_plan (usuario_id, created_at desc);

notify pgrst, 'reload schema';
