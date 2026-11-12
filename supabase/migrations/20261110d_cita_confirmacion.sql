-- Confirmación de la cita de la visita por el compita: el cliente PROPONE fecha y hora, y la visita no queda programada hasta que el compita confirme.
-- La propuesta vive en columnas aparte (la visita sigue con su estado y su fecha de siempre hasta que se confirme). SOLO AGREGA columnas. Seguro de repetir.

alter table public.visitas
  add column if not exists cita_propuesta_fecha  date,
  add column if not exists cita_propuesta_inicio text,
  add column if not exists cita_propuesta_fin    text,
  add column if not exists cita_propuesta_en     timestamptz,
  add column if not exists cita_recordada_en     timestamptz,
  add column if not exists cita_escalada_en      timestamptz;

create index if not exists visitas_cita_pendiente_idx on public.visitas (cita_propuesta_en) where cita_propuesta_en is not null;
notify pgrst, 'reload schema';
