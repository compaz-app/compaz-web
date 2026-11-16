-- Datos de seguridad del lugar privado en la solicitud (menores, cuánto tiempo estarán los demás, animales, precaución). Solo AGREGA una columna; seguro de repetir.
-- Son opciones, sin nombres ni texto libre. Las solicitudes anteriores quedan en null y no muestran nada.
alter table public.solicitudes add column if not exists datos_lugar jsonb;
notify pgrst, 'reload schema';
