#!/usr/bin/env bash
# Segunda instancia LOCAL (puerto 3001) conectada SOLO a la base de demostración (la vieja de São Paulo).
# Tu instancia normal (npm run dev, puerto 3000, .env.local) sigue apuntando a producción y no se entera de esta.
# Sin claves de Telegram, correo ni Daily: ningún aviso simulado sale de verdad.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; RAIZ="$AQUI/../.."
leer() { local v=""; while IFS= read -r l || [ -n "$l" ]; do case "$l" in "$2="*) v="${l#"$2="}";; esac; done < "$1"; printf '%s' "$v"; }
MIG="$AQUI/../migracion/.env.migracion"; LOCAL="$RAIZ/.env.local"
export NEXT_PUBLIC_SUPABASE_URL="$(leer "$MIG" OLD_SUPABASE_URL)"
export SUPABASE_SERVICE_ROLE_KEY="$(leer "$MIG" OLD_SERVICE_KEY)"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGt6bHpibGFrbnpzeHFmbmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjE5MDcsImV4cCI6MjEwNjE5NzkwN30.ulYo0UVB-qJEXakqaft5zNEuzmKc7uW0w0Za7tnVu5U"
case "$NEXT_PUBLIC_SUPABASE_URL" in *qrhkzlzblaknzsxqfney*) ;; *) echo "La base de demo no es la esperada. Se detiene."; exit 1;; esac
export ADMIN_EMAILS="$(leer "$LOCAL" ADMIN_EMAILS)"
export NEXT_PUBLIC_SITE_URL="http://localhost:3001"
export TELEGRAM_BOT_TOKEN="" RESEND_API_KEY="" DAILY_API_KEY="" TELEGRAM_ADMIN_CHAT_ID="" TELEGRAM_WEBHOOK_SECRET="demo"
export PAGO_SIMULADO=true NEXT_DIST_DIR=".next-demo"
cd "$RAIZ"; exec npx next dev -p 3001
