#!/usr/bin/env bash
# Respaldo manual de la base de Compaz (O-01). No hace falta si el plan de Supabase ya trae copias diarias, pero sirve para tener una copia propia.
# Uso:  SUPABASE_DB_URL='postgresql://postgres:CLAVE@db.XXXX.supabase.co:5432/postgres' ./scripts/respaldo.sh
# La cadena de conexión está en Supabase, Project Settings, Database, Connection string (modo "Session pooler" o directa). NUNCA la pongas en el código.
# Deja un archivo comprimido en ./respaldos/ (esa carpeta no se sube a git). Para PROBAR que sirve, restáuralo en un proyecto de pruebas:
#   gunzip -c respaldos/AAAA-MM-DD.sql.gz | psql "$URL_DEL_PROYECTO_DE_PRUEBAS"
set -euo pipefail
: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (la cadena de conexión de la base)}"
command -v pg_dump >/dev/null || { echo "Falta pg_dump (instala PostgreSQL client: brew install libpq)"; exit 1; }
mkdir -p respaldos
archivo="respaldos/$(date +%Y-%m-%d_%H%M).sql.gz"
# Solo el esquema "public" (los datos de Compaz) y el de autenticación, sin permisos ni dueños para poder restaurar en otro proyecto.
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --schema=public --schema=auth | gzip > "$archivo"
echo "Listo: $archivo ($(du -h "$archivo" | cut -f1))"
