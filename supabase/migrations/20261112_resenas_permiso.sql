-- Reseñas: la clave de servicio (el servidor) no tenía permiso sobre la tabla y Supabase respondía "permission denied for table resenas".
-- Eso rompía la pantalla Más, Reseñas del panel. Solo AGREGA un permiso: no toca datos, políticas ni columnas, y se puede aplicar más de una vez.
-- anon y authenticated siguen sin permiso directo: las reseñas visibles las sigue sirviendo el servidor.
grant all on public.resenas to service_role;
