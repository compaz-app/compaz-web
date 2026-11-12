#!/usr/bin/env bash
# Copia estructura, datos y usuarios de acceso de la base VIEJA a la NUEVA. La vieja solo se LEE (pg_dump). Si la nueva ya tiene tablas, se detiene.
set -euo pipefail
cd "$(dirname "$0")"; . ./cargar-env.sh
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
n=$(psql "$NEW_DB_URL" -At -c "select count(*) from information_schema.tables where table_schema='public'")
[ "$n" = "0" ] || { echo "La base nueva ya tiene $n tablas. Si es un ensayo, corre primero ./00-vaciar-nueva.sh"; exit 1; }

echo "1/6 Extensiones en la nueva (las que usa el esquema)"
# Igual que la vieja: uuid-ossp y pgcrypto en "extensions"; pg_trgm en "public" (los índices de búsqueda usan public.gin_trgm_ops).
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -c 'create extension if not exists "uuid-ossp" with schema extensions;' -c 'create extension if not exists pgcrypto with schema extensions;' -c 'create extension if not exists pg_trgm with schema public;'

echo "2/6 Usuarios de acceso (auth.users, auth.identities) primero: las tablas de public apuntan a ellos"
pg_dump "$OLD_DB_URL" --data-only --no-owner --table=auth.users --table=auth.identities -f "$TMP/auth.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$TMP/auth.sql"

echo "3/6 Estructura y datos de public"
pg_dump "$OLD_DB_URL" --schema=public --no-owner -f "$TMP/public.raw.sql"
# El esquema public ya existe en el proyecto nuevo: se quita la orden que intenta crearlo.
# También se quitan los "permisos por defecto" del rol interno supabase_admin (nadie puede cambiarlos): el proyecto nuevo conserva los suyos, sin exponer tablas nuevas solas.
grep -v -E '^(CREATE SCHEMA public;|ALTER DEFAULT PRIVILEGES )' "$TMP/public.raw.sql" > "$TMP/public.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$TMP/public.sql"

echo "3b/6 Triggers sobre auth.users (pg_dump de public no los copia)"
psql "$OLD_DB_URL" -At -c "select pg_get_triggerdef(t.oid) || ';' from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and not t.tgisinternal" > "$TMP/triggers_auth.sql"
if [ -s "$TMP/triggers_auth.sql" ]; then psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$TMP/triggers_auth.sql"; cat "$TMP/triggers_auth.sql"; else echo "   (la vieja no tiene triggers sobre auth.users)"; fi

echo "4/6 Tiempo real (publication supabase_realtime)"
psql "$OLD_DB_URL" -At -c "select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'" > "$TMP/realtime.sql"
if [ -s "$TMP/realtime.sql" ]; then psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$TMP/realtime.sql"; cat "$TMP/realtime.sql"; else echo "   (la vieja no publica ninguna tabla)"; fi

echo "5/6 Políticas de almacenamiento de la vieja (para revisar a mano: no se copian solas)"
psql "$OLD_DB_URL" -c "select policyname, cmd, qual, with_check from pg_policies where schemaname='storage'"

echo "6/6 Listo. Siguiente: node 02-copiar-fotos.mjs y luego ./03-verificar.sh"
