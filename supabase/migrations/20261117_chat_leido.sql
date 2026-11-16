-- Mensajes sin leer del portal del cliente: guarda hasta cuándo leyó su chat. Solo AGREGA una columna. Seguro de repetir.
--  - usuarios.chat_leido_en: la última vez que el cliente tuvo su chat a la vista. Los mensajes del compita o del equipo posteriores a esa hora son «sin leer».
alter table public.usuarios add column if not exists chat_leido_en timestamptz;
notify pgrst, 'reload schema';
