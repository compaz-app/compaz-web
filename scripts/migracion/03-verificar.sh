#!/usr/bin/env bash
# Compara el número de filas de cada tabla (y de los usuarios de acceso) entre la base vieja y la nueva. Solo lee.
set -euo pipefail
cd "$(dirname "$0")"; . ./cargar-env.sh
tablas=$(psql "$OLD_DB_URL" -At -c "select table_schema||'.'||table_name from information_schema.tables where table_type='BASE TABLE' and (table_schema='public' or table_name in ('users','identities') and table_schema='auth') order by 1")
mal=0; total=0
printf "%-45s %10s %10s\n" tabla vieja nueva
for t in $tablas; do
  a=$(psql "$OLD_DB_URL" -At -c "select count(*) from $t"); b=$(psql "$NEW_DB_URL" -At -c "select count(*) from $t" 2>/dev/null || echo "NO EXISTE")
  marca="  ok"; [ "$a" = "$b" ] || { marca="  DIFERENTE"; mal=$((mal+1)); }
  printf "%-45s %10s %10s%s\n" "$t" "$a" "$b" "$marca"; total=$((total+1))
done
echo; echo "Funciones de public (vieja / nueva):"
psql "$OLD_DB_URL" -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'" | tr '\n' ' '; psql "$NEW_DB_URL" -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"
echo "Triggers sobre auth.users (vieja / nueva):"
Q="select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and not t.tgisinternal"
psql "$OLD_DB_URL" -At -c "$Q" | tr '\n' ' '; psql "$NEW_DB_URL" -At -c "$Q"
echo "Tablas en tiempo real (vieja / nueva):"
psql "$OLD_DB_URL" -At -c "select count(*) from pg_publication_tables where pubname='supabase_realtime'" | tr '\n' ' '; psql "$NEW_DB_URL" -At -c "select count(*) from pg_publication_tables where pubname='supabase_realtime'"
echo "Políticas RLS de public (vieja / nueva):"
psql "$OLD_DB_URL" -At -c "select count(*) from pg_policies where schemaname='public'" | tr '\n' ' '; psql "$NEW_DB_URL" -At -c "select count(*) from pg_policies where schemaname='public'"
echo; if [ "$mal" = 0 ]; then echo "TODO IGUAL ($total tablas)."; else echo "HAY $mal TABLAS DIFERENTES. No cambies las claves de Netlify."; exit 1; fi
