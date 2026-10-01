# Compaz Platform

Portal de clientes, panel admin y bot de Telegram para el servicio de cuidado Compaz.

**Stack:** Next.js 15 (App Router) · Supabase · TypeScript · Tailwind CSS  
**Deploy:** Netlify  
**Docs de negocio:** [`docs/flows.md`](docs/flows.md)

---

## Setup local

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd compaz
npm install
```

### 2. Variables de entorno

Crea `.env.local` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_SECRET=una-cadena-secreta-aleatoria
TELEGRAM_ADMIN_CHAT_ID=tu-chat-id-de-telegram

# Resend (emails)
RESEND_API_KEY=re_...

# Daily.co (videollamadas)
DAILY_API_KEY=...

# Cloudflare Turnstile (anti-bot en landing)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...

# Admins (emails separados por coma)
ADMIN_EMAILS=juan@compaz.com,otro@compaz.com

# URL pública de la app
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Base de datos

El schema completo está en [`docs/schema.sql`](docs/schema.sql). Ejecutarlo en el SQL editor de Supabase.

> La tabla `solicitudes` es nueva — si el proyecto ya tenía otras tablas, solo ejecutar la sección correspondiente.

### 4. Correr local

```bash
npm run dev
```

La app corre en `http://localhost:3000`.

### 5. Configurar el bot de Telegram

Una vez corriendo con URL pública (o usando ngrok para local):

```
GET /api/setup-webhook
```

Esto registra el webhook del bot de Telegram apuntando a `/api/telegram-webhook`.

---

## Estructura del proyecto

```
compaz/
├── app/
│   ├── api/              # API routes (Next.js route handlers)
│   │   ├── admin/        # Endpoints solo para admins
│   │   ├── onboarding/   # Registro de nuevas compitas
│   │   └── ...
│   ├── admin/            # Panel admin (componentes)
│   ├── compitas/         # Marketplace de compitas
│   ├── dashboard/        # Portal del cliente
│   └── onboarding/       # Flujo de registro de compita
├── components/
│   └── ui/               # Componentes reutilizables (mapa, etc.)
├── lib/
│   ├── api.ts            # Helpers de respuesta HTTP estándar
│   ├── auth.ts           # Autenticación y roles
│   ├── compitas.ts       # Lógica de negocio: compitas
│   ├── design.ts         # Design tokens (colores, spacing, z-index)
│   ├── solicitudes.ts    # Lógica de negocio: solicitudes de entrevista
│   ├── usuarios.ts       # Lógica de negocio: usuarios/clientes
│   ├── telegram.ts       # Envío de mensajes por Telegram
│   ├── resend.ts         # Envío de emails
│   ├── daily.ts          # Salas de videollamada (Daily.co)
│   └── supabase-server.ts
├── types/
│   └── index.ts          # Todos los tipos TypeScript
└── docs/
    ├── schema.sql        # Schema completo de la BD
    ├── api.md            # Referencia de endpoints
    └── flows.md          # Flujos de negocio en lenguaje llano
```

---

## Reglas de desarrollo

Ver [`CLAUDE.md`](CLAUDE.md) para las reglas obligatorias (URL state, responsive, design tokens, capa de negocio, respuestas de API estándar).

---

## Roles

| Rol | Cómo se determina | Acceso |
|-----|-------------------|--------|
| Cliente | Cualquier usuario autenticado | Dashboard, marketplace, solicitudes |
| Admin | Email en `ADMIN_EMAILS` env var | Todo + panel admin |
| Compita | `telegram_chat_id` en tabla `compitas` | Bot de Telegram |

No hay tabla de roles. Los admins se definen en la variable de entorno.

---

## Flujos principales

Ver [`docs/flows.md`](docs/flows.md) para la descripción completa. En resumen:

1. **Compita se registra** → admin la verifica → aparece en el mapa
2. **Cliente se registra** → ve el marketplace → solicita entrevista con hasta 3 compitas
3. **Compita acepta/rechaza** via Telegram → admin coordina llamada de 20 min
4. **Visita en tiempo real**: compita inicia/termina vía bot → cliente recibe updates

---

## Servicios externos

| Servicio | Uso | Config |
|----------|-----|--------|
| Supabase | BD + Auth + Realtime | `NEXT_PUBLIC_SUPABASE_*` |
| Telegram | Bot para compitas | `TELEGRAM_BOT_TOKEN` |
| Resend | Emails al cliente | `RESEND_API_KEY` |
| Daily.co | Videollamadas 20 min | `DAILY_API_KEY` |
| Cloudflare Turnstile | Anti-bot en landing | `TURNSTILE_*` |
| Netlify | Deploy | UI de Netlify |
