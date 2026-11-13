#!/usr/bin/env bash
# Prueba local de la migración 20261113b_cmc_sincronizaciones_permisos en un Postgres desechable.
# Reproduce el estado de compaz-prod (service_role con todos los privilegios, sin historial
# de migraciones), aplica la corrección dos veces y comprueba permisos, RLS, restricciones y datos.
# Uso: DB_URL=postgresql://... bash tests/sql/cmc_permisos_local.sh   (base vacía y desechable)
set -euo pipefail
: "${DB_URL:?Falta DB_URL (base desechable)}"
cd "$(dirname "$0")/../.."
q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }

echo "1. Base sin la tabla: la corrección no hace nada y no falla"
q -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; -- como en Supabase
end \$\$; grant usage on schema public to anon, authenticated, service_role;"
q -f supabase/migrations/20261113b_cmc_sincronizaciones_permisos.sql

echo "2. Estado de compaz-prod: esquema de 20261111 + service_role con todos los privilegios + 1 fila"
q -c "create table if not exists public.compitas (id uuid primary key default gen_random_uuid(), codigo text unique, nombre text not null default 'x');"
q -f supabase/migrations/20261111_cmc_compitas.sql
q -c "grant all on public.cmc_sincronizaciones to service_role;"
q -c "insert into public.cmc_sincronizaciones (estado, recibidas, resumen) values ('aplicada', 2, '{\"prueba\":true}');"
antes=$(psql "$DB_URL" -At -c "select md5(string_agg(t::text, '|' order by id)) from public.cmc_sincronizaciones t")
if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f tests/sql/cmc_sincronizaciones_permisos.sql 2>/dev/null; then echo "La comprobación debía fallar antes de corregir"; exit 1; fi

echo "3. Corrección aplicada dos veces (idempotente)"
q -f supabase/migrations/20261113b_cmc_sincronizaciones_permisos.sql
q -f supabase/migrations/20261113b_cmc_sincronizaciones_permisos.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f tests/sql/cmc_sincronizaciones_permisos.sql

echo "4. Datos intactos y operaciones de la web (como service_role)"
despues=$(psql "$DB_URL" -At -c "select md5(string_agg(t::text, '|' order by id)) from public.cmc_sincronizaciones t")
test "$antes" = "$despues" || { echo "Cambiaron los datos"; exit 1; }
q -c "set role service_role; select count(*) from public.cmc_sincronizaciones; insert into public.cmc_sincronizaciones (estado) values ('rechazada'); reset role;"
for op in "update public.cmc_sincronizaciones set motivo='x'" "delete from public.cmc_sincronizaciones" "truncate public.cmc_sincronizaciones"; do
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "set role service_role; $op;" 2>/dev/null; then echo "service_role pudo: $op"; exit 1; fi
done
if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "set role anon; select 1 from public.cmc_sincronizaciones;" 2>/dev/null; then echo "anon pudo leer"; exit 1; fi
echo "TODO OK"
