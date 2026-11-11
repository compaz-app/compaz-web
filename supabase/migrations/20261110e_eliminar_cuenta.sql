-- Eliminar mi cuenta (decidido 2026-11-10). Solo AGREGA columnas.
-- El cliente pide eliminar → recibe un enlace (vence en 1 hora; se guarda solo su huella) → al confirmar queda desactivado
-- y se borra de forma definitiva a los 7 días (eliminacion_programada_en). Si entra antes, puede reactivarla.
-- Al borrar: se vacían sus datos personales y se conservan pagos y visitas anonimizados (eliminada_en marca la cuenta ya borrada).
alter table public.usuarios
  add column if not exists eliminar_enlace_hash     text,
  add column if not exists eliminar_enlace_vence    timestamptz,
  add column if not exists eliminar_enlace_pedido   timestamptz,
  add column if not exists eliminacion_programada_en timestamptz,
  add column if not exists eliminada_en             timestamptz;
