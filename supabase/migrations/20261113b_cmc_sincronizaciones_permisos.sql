-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Permisos de cmc_sincronizaciones (corrección tras el traslado a compaz-prod)
--
-- Estado: APLICADA en compaz-prod el 13-nov-2026 a las 19:27 UTC (autorización de Luis, aplicada por Claude
-- con la herramienta apply_migration del conector de Supabase; registrada en supabase_migrations como
-- 20261113192755). Comprobación posterior OK. Se puede volver a ejecutar sin efecto (idempotente).
--
-- Por qué:
--   cmc_sincronizaciones es el registro de cada foto que envía el CMC (aplicada o
--   rechazada), con el antes y el después de cada cambio; sirve para auditar y revertir.
--   En la migración 20261111_cmc_compitas, service_role solo podía LEER y AÑADIR (registro
--   de solo anexado: nadie puede alterar ni borrar el historial desde la web).
--   Al copiar la base a compaz-prod (12-nov, pg_dump del esquema public) service_role
--   quedó con todos los privilegios (UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER).
--   Esta migración devuelve el estado aprobado.
--
-- Qué hace (solo privilegios; no toca datos, columnas, restricciones ni RLS):
--   · service_role: conserva SELECT e INSERT; pierde UPDATE, DELETE, TRUNCATE,
--     REFERENCES y TRIGGER. Es exactamente lo que usa lib/cmc-compitas.ts
--     (leer la última foto aplicada y añadir una fila por foto).
--   · anon, authenticated y PUBLIC: ningún privilegio (como en 20261111).
--   · RLS: se asegura activada (idempotente); no se crean ni quitan políticas.
--
-- Segura e idempotente:
--   · Si la tabla no existe (base sin la migración 20261111), no hace nada y lo avisa.
--   · Se puede ejecutar varias veces: REVOKE/GRANT/ENABLE RLS repetidos no cambian nada.
--   · No depende del historial de migraciones.
--   · Todo en una transacción: o se aplica entero o no se aplica.
--
-- Comprobación: tests/sql/cmc_sincronizaciones_permisos.sql (debe terminar en "OK").
-- Vuelta atrás (solo si hiciera falta): grant all on public.cmc_sincronizaciones to service_role;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.cmc_sincronizaciones') is null then
    raise notice 'cmc_sincronizaciones no existe: falta la migración 20261111_cmc_compitas. No se cambia nada.';
    return;
  end if;

  revoke all on table public.cmc_sincronizaciones from public, anon, authenticated, service_role;
  grant select, insert on table public.cmc_sincronizaciones to service_role;
  alter table public.cmc_sincronizaciones enable row level security;
end
$$;

commit;
