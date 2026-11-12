#!/usr/bin/env bash
# Carga .env.migracion y comprueba que las dos bases son distintas. Nunca imprime contraseñas.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Se lee línea por línea (CLAVE=valor), sin interpretar el contenido: así los símbolos como & # $ no rompen nada.
for f in "$AQUI/.env.migracion" "$AQUI/../../.env.migracion"; do
  if [ -f "$f" ]; then
    while IFS= read -r linea || [ -n "$linea" ]; do
      case "$linea" in ''|'#'*) continue;; esac
      clave="${linea%%=*}"; valor="${linea#*=}"
      case "$clave" in OLD_DB_URL|NEW_DB_URL|OLD_SUPABASE_URL|NEW_SUPABASE_URL|OLD_SERVICE_KEY|NEW_SERVICE_KEY) export "$clave=$valor";; esac
    done < "$f"
    break
  fi
done
for v in OLD_DB_URL NEW_DB_URL; do
  [ -n "${!v:-}" ] || { echo "Falta $v en .env.migracion"; exit 1; }
done
[ "$OLD_DB_URL" != "$NEW_DB_URL" ] || { echo "OLD_DB_URL y NEW_DB_URL son iguales: se detiene para no dañar nada."; exit 1; }
case "$NEW_DB_URL" in *qrhkzlzblaknzsxqfney*) echo "NEW_DB_URL apunta al proyecto VIEJO (São Paulo). Se detiene."; exit 1;; esac
host() { echo "$1" | sed -E 's#^[a-z]+://[^@]*@([^:/]+).*#\1#'; }
echo "Base vieja: $(host "$OLD_DB_URL")"
echo "Base nueva: $(host "$NEW_DB_URL")"
