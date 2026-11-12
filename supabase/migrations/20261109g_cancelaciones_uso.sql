-- Regla de cancelación de 24 horas: si el cliente cancela con menos aviso, la visita CUENTA COMO USADA.
-- Para poder descontarla del saldo hay que guardar si cuenta como usada y cuándo se creó la visita (que se borra al cancelar).
-- SOLO AGREGA columnas a cancelaciones; nada existente cambia. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

alter table public.cancelaciones
  add column if not exists cuenta_como_usada boolean not null default false,
  add column if not exists visita_creada_en  timestamptz;

comment on column public.cancelaciones.cuenta_como_usada is
  'true cuando el cliente canceló con menos aviso que cancelacion_gratis_horas: la visita descuenta del saldo salvo que el equipo la marque justificada.';
notify pgrst, 'reload schema';
