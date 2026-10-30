#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Compaz · Bloque 1 · Prueba de concurrencia de registrar_postulacion
# Ejecutar SOLO contra staging o una base local desechable:
#   DB_URL="postgres://…staging…" bash tests/sql/concurrencia.sh
# Lanza N envíos simultáneos de la misma persona (dos variantes de nombre) y
# comprueba que hay 1 persona, 1 postulación registrada, 1 repetida y el resto
# reintentos técnicos. No borra nada (eventos es inmutable): usa un teléfono
# reservado para pruebas y aborta si la base tiene datos de operación.
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
: "${DB_URL:?Falta DB_URL}"
N="${N:-10}"
TEL="+584125550000"   # teléfono reservado para esta prueba

# Cuenta filas de operación solo si las tablas existen (en una base vacía no existen)
guardia=$(psql "$DB_URL" -At -c "select coalesce(sum(case when to_regclass(t) is null then 0 else (xpath('/row/n/text()', query_to_xml('select count(*) as n from ' || t, false, true, '')))[1]::text::int end), 0) from unnest(array['public.compitas', 'public.usuarios']) as t" 2>/dev/null || echo error)
if [ "$guardia" != "0" ]; then echo "ABORTADO: la base tiene compitas o usuarios; esto no es staging." >&2; exit 1; fi
previas=$(psql "$DB_URL" -At -c "select count(*) from public.postulaciones where telefono_declarado = '$TEL'")
if [ "$previas" != "0" ]; then echo "ABORTADO: ya hay postulaciones con el teléfono de prueba." >&2; exit 1; fi

tmp=$(mktemp -d)
for i in $(seq 1 "$N"); do
  psql "$DB_URL" -At -c "set role service_role; select resultado from public.registrar_postulacion(gen_random_uuid(), 'compita', 'home', 'Concurrente $((i % 2))', '$TEL', 'concurrente@ejemplo.com', null, null, '$TEL', 'concurrente@ejemplo.com', 'Caracas');" > "$tmp/$i" 2>&1 &
done
wait

echo "Resultados de $N envíos simultáneos:"
cat "$tmp"/* | sort | uniq -c
personas=$(psql "$DB_URL" -At -c "select count(*) from public.personas where telefono_e164 = '$TEL'")
registradas=$(psql "$DB_URL" -At -c "select count(*) from public.postulaciones where telefono_declarado = '$TEL' and clasificacion = 'pendiente'")
repetidas=$(psql "$DB_URL" -At -c "select count(*) from public.postulaciones where telefono_declarado = '$TEL' and clasificacion = 'repetida'")
reintentos=$(grep -c reintento_tecnico "$tmp"/* | awk -F: '{s+=$2} END {print s}')
rm -rf "$tmp"
echo "personas=$personas registradas=$registradas repetidas=$repetidas reintentos=$reintentos"
[ "$personas" = "1" ] && [ "$registradas" = "1" ] && [ "$repetidas" = "1" ] && [ "$reintentos" = "$((N - 2))" ] \
  && echo "OK: concurrencia correcta" || { echo "FALLO: resultado inesperado" >&2; exit 1; }
