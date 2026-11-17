#!/usr/bin/env bash
# Corre la siembra de demo SOLO contra la base vieja (OLD_DB_URL de scripts/migracion/.env.migracion). Nunca imprime contraseñas.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OLD_DB_URL=""
while IFS= read -r l || [ -n "$l" ]; do case "$l" in OLD_DB_URL=*) OLD_DB_URL="${l#OLD_DB_URL=}";; esac; done < "$AQUI/../migracion/.env.migracion"
[ -n "$OLD_DB_URL" ] || { echo "Falta OLD_DB_URL"; exit 1; }
case "$OLD_DB_URL" in *jizckcfuemgfbmopbhbh*) echo "Eso es PRODUCCIÓN. Se detiene."; exit 1;; esac
for f in ${1:-"$AQUI/siembra-demo.sql" "$AQUI/siembra-actividad.sql"}; do psql "$OLD_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
