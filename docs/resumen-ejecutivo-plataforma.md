# Compaz — Resumen Ejecutivo de la Plataforma Digital

**Para:** Luis  
**Propósito:** Análisis de complementación con sistema de gestión en Excel  
**Fecha:** Octubre 2026

---

## ¿Qué es Compaz?

Compaz es un marketplace de cuidado para adultos mayores que conecta familias venezolanas con cuidadoras venezolanas ("compitas"). La plataforma gestiona todo el ciclo: desde que una familia descubre a una compita hasta que la visita está en curso y documentada en tiempo real.

---

## Arquitectura General

```
Landing Page (micompaz.com)
        │
        ├── Portal del Cliente (web app)
        │       └── Dashboard, mapa, marketplace, seguimiento de visitas
        │
        ├── Panel Admin (web app, acceso restringido)
        │       └── Gestión de compitas, solicitudes, visitas, alertas
        │
        ├── Bot de Telegram (canal del compita)
        │       └── Notificaciones, inicio/fin de visitas, fotos
        │
        └── Backend API (Next.js + Supabase)
                └── Lógica de negocio, automatizaciones, emails
```

**Stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Frontend + API | Next.js 15 (App Router), desplegado en Netlify |
| Base de datos | Supabase (PostgreSQL) con Row Level Security |
| Autenticación | Supabase Auth (email/Google) |
| Bot de mensajería | Telegram Bot API |
| Emails transaccionales | Resend |
| Videollamadas | Daily.co (salas de 20 min) |
| Protección anti-bot | Cloudflare Turnstile |

---

## Módulos y Funciones

### 1. Registro y Verificación de Compitas

- Una compita llena un formulario de inscripción (nombre, zona, descripción, servicios, foto, video de YouTube, horarios disponibles).
- Queda en estado **pendiente de verificación** — invisible para clientes.
- El admin la revisa y la verifica con un clic.
- Solo entonces aparece en el mapa y el marketplace.
- El admin puede desactivar, reactivar o bloquear una compita en cualquier momento.
- La compita recibe un email de bienvenida con instrucciones para vincular su cuenta de Telegram.

**Estados de una compita:** `activo` / `inactivo` / `bloqueado`, con flag `verificado` (true/false).

---

### 2. Registro de Clientes

- El cliente se registra con email o Google vía Supabase Auth.
- Se crea un perfil en la tabla `usuarios` con nombre, zona y plan.
- El admin puede ver todos los clientes, y puede bloquear una cuenta (`plan = 'bloqueado'`).

---

### 3. Marketplace y Mapa

- El cliente navega el mapa interactivo y el marketplace de perfiles.
- Solo aparecen compitas activas, verificadas y con Telegram vinculado.
- Cada perfil muestra: nombre, zona, descripción, servicios, video, disponibilidad y visitas realizadas.

---

### 4. Solicitud de Entrevista

Flujo completo de contacto inicial entre cliente y compita:

1. Cliente elige una compita y propone hasta 3 horarios para una llamada de 20 minutos.
2. El sistema crea una **solicitud** y notifica a la compita por Telegram con botones de respuesta.
3. La compita acepta un horario o rechaza desde Telegram.
4. Si acepta, el sistema crea automáticamente la sala de videollamada (Daily.co) y envía los links a ambas partes.
5. Ambos entran a la llamada de presentación desde sus links personales.
6. Después de la llamada, el cliente indica si quiere contratar, reagendar o no contratar.

**Límites de seguridad:**
- Máximo 5 solicitudes por cliente en 24 horas (anti-spam).
- Los clientes bloqueados no pueden solicitar.
- Solo compitas activas y verificadas reciben solicitudes.

**Estados de una solicitud:** `pendiente` → `aceptada` / `rechazada` → `completada` / `contratada`.

---

### 5. Visitas en Tiempo Real

Una vez contratada una compita:

1. La compita abre Telegram y toca **"▶️ Iniciar visita"**.
2. El sistema registra la hora de inicio y notifica al cliente por email.
3. Durante la visita, la compita puede enviar fotos y mensajes de texto desde Telegram.
4. Esos mensajes aparecen en el **dashboard del cliente en tiempo real** (Supabase Realtime).
5. Al terminar, la compita toca **"🔴 Terminar visita"**.
6. El sistema registra la hora de fin y envía al cliente un resumen por email (duración, fotos, mensajes).

**La compita también puede:**
- Reportar una novedad (incidente, observación importante).
- Ver el historial de sus visitas anteriores.

---

### 6. Sistema de Valoración Post-Visita

- Después de cada visita, el cliente recibe un email con links para calificar del 1 al 5.
- El token del link incluye el valor de la calificación firmado con HMAC-SHA256 para evitar manipulaciones.
- El admin ve el promedio de valoraciones de cada compita en el panel.

---

### 7. Automatizaciones y Crons

El sistema ejecuta 5 tareas automáticas programadas:

| Cron | Frecuencia | Función |
|------|-----------|---------|
| `recordatorio-primera-visita` | Diario 10am VE | Email de recordatorio al cliente el día anterior a su primera visita |
| `recordatorios` | Cada 5 min | Alerta al admin si una sala de llamada lleva más de 10 min sin participantes |
| `recordatorio-cuestionario` | Por definir | Envía cuestionario de satisfacción post-visita por Telegram |
| `noshow-alerta` | Cada 5 min | Detecta compitas que debían iniciar una visita hace 30+ min y no lo hicieron |
| `cierre-rechazo` | Diario | Cierra automáticamente solicitudes sin respuesta después de X días |

---

### 8. Panel de Administración

El admin tiene acceso a:

- **Compitas:** lista completa, verificar, desactivar, bloquear, editar perfil, ver historial de visitas.
- **Clientes:** lista completa, ver solicitudes por cliente, ver visitas, detección de clientes inactivos (tienen compita asignada pero sin visitas en 30 días).
- **Solicitudes:** todas las solicitudes del sistema con estado, compita, cliente y fechas.
- **Visitas:** todas las visitas con estado, duración, compita y cliente.
- **Enviar link de llamada:** crear sala Daily.co manualmente y enviar a cliente y compita.
- **Flags de admin:** notas internas sobre cualquier registro.
- **Alertas automáticas:** recibe mensajes de Telegram cuando hay situaciones que requieren atención (sala vacía, compita no llegó, solicitud sin Telegram vinculado).

---

## Base de Datos — Tablas Principales

| Tabla | Contenido |
|-------|----------|
| `compitas` | Perfil, estado, zona, servicios, Telegram chat_id, valoraciones |
| `usuarios` | Clientes registrados, plan, compita asignada |
| `solicitudes` | Solicitudes de entrevista con estado, slots propuestos, token de respuesta |
| `visitas` | Visitas en curso o terminadas, horarios, estado |
| `mensajes` | Chat de cada visita (fotos + texto) |
| `telegram_estados` | Estado de la conversación del bot por compita |
| `reportes_visita` | Reportes de novedad enviados desde Telegram |
| `admin_flags` | Notas internas del admin sobre cualquier registro |
| `compita_edit_tokens` | Tokens para que la compita edite su perfil |
| `action_tokens` | Tokens de un solo uso para flujos de interés (legacy) |

---

## Flujo de Datos — Resumen Visual

```
Cliente                 Sistema                  Compita (Telegram)
  │                        │                           │
  │── solicitud ──────────>│                           │
  │                        │── notificación ──────────>│
  │                        │<── acepta slot ───────────│
  │<── email confirmación ─│                           │
  │                        │── crea sala Daily.co      │
  │<── link de llamada ────│── link de llamada ───────>│
  │                        │                           │
  │    [LLAMADA 20 MIN]     │                           │
  │                        │                           │
  │── "quiero contratar" ─>│                           │
  │                        │                           │
  │              [VISITAS EN CURSO]                    │
  │                        │<─── "iniciar visita" ─────│
  │<── email inicio ───────│                           │
  │<── mensajes/fotos ─────│<─── mensajes Telegram ────│
  │<── email resumen ──────│<─── "terminar visita" ────│
  │                        │                           │
  │<── email valoración ───│                           │
```

---

## Lo que el Sistema NO hace (oportunidades de complementación)

1. **No calcula pagos ni facturación.** No hay registro de tarifas, horas trabajadas o pagos. Todo lo económico está fuera del sistema.
2. **No tiene agenda/calendario visual.** Las visitas tienen fecha programada pero no hay vista de calendario tipo agenda.
3. **No tiene reportes agregados.** No hay gráficas de desempeño, horas por compita, tendencias, etc.
4. **No tiene seguimiento de contratos.** Una solicitud marcada como "contratada" no genera ningún documento ni seguimiento formal del contrato.
5. **No gestiona la relación post-contratación a profundidad.** Sí registra visitas, pero no hay CRM de la relación cliente-compita a largo plazo.
6. **No calcula indicadores de rendimiento.** KPIs como tasa de conversión solicitud→contrato, duración media de visitas, rotación de compitas, etc., están disponibles en la base de datos pero no calculados.
7. **No tiene notificaciones push.** Solo email y Telegram. No hay app móvil ni PWA con notificaciones.

---

## Datos disponibles para integración con Excel

Todo está en PostgreSQL (Supabase). Luis puede consultar directamente la base de datos o usar la API. Los datos más útiles para complementar con Excel:

- Número de solicitudes por período, por zona, por compita.
- Tasa de aceptación de compitas.
- Duración promedio de visitas.
- Valoraciones por compita.
- Clientes activos vs inactivos.
- Visitas realizadas por compita (ya en el perfil público).
- Tiempo desde solicitud hasta primera visita.
- Tasa de conversión solicitud → contratación.

**Acceso a datos:** Supabase tiene una API REST automática y también acepta conexiones directas de PostgreSQL (para Power Query en Excel o cualquier herramienta de BI).

---

*Documento generado en octubre 2026 como referencia técnica para análisis de integración.*
