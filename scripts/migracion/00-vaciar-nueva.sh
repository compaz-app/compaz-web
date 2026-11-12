#!/usr/bin/env bash
# SOLO para repetir un ensayo: deja la base NUEVA vacía otra vez (borra el esquema public y los usuarios de acceso copiados). Nunca toca la vieja.
set -euo pipefail
cd "$(dirname "$0")"; . ./cargar-env.sh
echo; read -r -p "Esto BORRA todo en la base NUEVA (Virginia). Escribe VACIAR para seguir: " r
[ "$r" = "VACIAR" ] || { echo "Cancelado."; exit 1; }
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
delete from auth.identities;
delete from auth.users;
SQL
echo "Base nueva vacía."
