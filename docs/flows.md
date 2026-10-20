# Compaz Platform — Flujos de negocio

Descripción en lenguaje llano de los flujos principales para onboarding de programadores.

---

## 1. Flujo de registro de compita

```
Compita llega a la landing → Llena formulario básico (nombre, zona, foto, etc.)
→ Se crea fila en `compitas` con estado=activo, verificado=false
→ Aparece en el panel admin como "Pendiente de verificación"
→ Admin revisa y hace clic en "Verificar"
→ verificado=true → aparece en el mapa y en el marketplace
→ Si admin desactiva → estado=inactivo → desaparece del mapa
```

**Regla clave:** Un compita NUNCA es visible para clientes hasta que `verificado=true` AND `estado='activo'`.

---

## 2. Flujo de registro de cliente

```
Cliente ve los anuncios (Meta Ads) → Llega a la landing
→ Hace clic en "Quiero conocer a una compita"
→ Se registra con email/Google (Supabase Auth)
→ Se crea fila en `usuarios`
→ Llega al dashboard → puede ver el mapa y el marketplace
```

---

## 3. Flujo de solicitud de entrevista (carrito de compitas)

```
Cliente entra al marketplace → Ve perfiles de compitas verificadas
→ Le interesa una → clic en "Me interesa conocerla"
→ Llena formulario: describe a su familiar, qué necesita, franja horaria preferida
→ API crea fila en `solicitudes` (estado=pendiente, token_respuesta único)
→ Bot de Telegram envía mensaje al compita con resumen + botones Aceptar/Rechazar
→ Compita responde desde Telegram
→ Link llama a GET /api/solicitud/responder?token=xxx&accion=aceptar|rechazar
→ estado se actualiza → cliente ve el cambio en su dashboard

Límite: máximo 3 solicitudes pendientes simultáneas por cliente.
```

**Nota:** El `token_respuesta` es de un solo uso y único por solicitud. Evita que el compita responda más de una vez.

---

## 4. Flujo de coordinación de llamada (admin)

```
Solicitud aceptada → Admin ve la solicitud en su panel
→ Admin coordina fecha/hora con ambas partes (por ahora manual)
→ Admin crea sala Daily.co vía POST /api/llamada/crear
→ Sala expira a los 23 minutos (20 para la llamada + 3 de gracia)
→ Admin envía link a cliente y compita
→ Ambos entran a la llamada → se conocen
→ Admin marca solicitud como completada

Futuro: automatizar con disponibilidad del compita y elección de slots por el cliente.
```

**Regla clave:** La llamada tiene un límite de 20 minutos. Se informa a ambas partes antes de la llamada y la sala se cierra automáticamente a los 23 min.

---

## 5. Flujo de visita en tiempo real

```
Compita llega donde el familiar
→ Abre Telegram → Bot le muestra botón "▶️ Iniciar visita"
→ Clic → Bot pregunta "¿Sí, iniciar?" → Confirma
→ visitas.estado = 'en_curso', visitas.inicio = now()
→ Cliente recibe email de notificación (Resend)
→ Durante la visita: compita puede enviar fotos y mensajes por Telegram
→ Esos mensajes se guardan en `mensajes` y aparecen en el dashboard del cliente en tiempo real

Al terminar:
→ Compita toca "🔴 Terminar visita" → Confirma
→ visitas.estado = 'terminada', visitas.fin = now()
→ Se envía email resumen al cliente con duración, fotos y mensajes
```

---

## 6. Estados de un compita

| estado | verificado | Visible en mapa | Visible en marketplace |
|--------|-----------|-----------------|------------------------|
| activo | false | ❌ | ❌ |
| activo | true | ✅ | ✅ |
| inactivo | any | ❌ | ❌ |

---

## 7. Estados de una solicitud

| estado | Significado |
|--------|-------------|
| pendiente | Cliente la creó, compita no ha respondido |
| aceptada | Compita aceptó, admin coordina llamada |
| rechazada | Compita rechazó, cliente puede intentar con otro |
| completada | Llamada de presentación realizada |

---

## 8. Roles y permisos

| Rol | Cómo se determina | Permisos |
|-----|-------------------|----------|
| Cliente | Email en `usuarios` (cualquiera) | Ver su dashboard, compitas, solicitudes |
| Admin | Email en `ADMIN_EMAILS` env var | Todo lo anterior + panel admin, verificar compitas, ver todas las solicitudes |
| Compita | `telegram_chat_id` en `compitas` | Responder solicitudes vía Telegram, iniciar/terminar visitas |

**Nota:** No hay tabla de roles. Los admins se definen en la variable de entorno `ADMIN_EMAILS` (lista separada por comas). Verificar en `lib/auth.ts → isAdminEmail()`.

---

## 9. Servicios externos

| Servicio | Uso |
|----------|-----|
| **Supabase** | Base de datos, autenticación, Realtime para el mapa en vivo |
| **Telegram Bot** | Notificaciones a compitas, flujo de visitas, respuesta a solicitudes |
| **Resend** | Emails al cliente (inicio de visita, resumen, notificaciones) |
| **Daily.co** | Videollamadas de presentación (20 min máximo) |
| **Cloudflare Turnstile** | Protección anti-bot en el formulario de la landing |
| **Netlify** | Deploy del frontend (Next.js) |

---

## 10. Variables de entorno requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# Daily.co
DAILY_API_KEY=

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Admins (emails separados por coma)
ADMIN_EMAILS=juan@compaz.com,otro@compaz.com

# App URL (para links en Telegram)
NEXT_PUBLIC_APP_URL=https://micompaz.com
```

---

## 11. Reclutamiento de Compitas desde flyers

Los flyers impresos en universidades tienen un QR que no se puede cambiar. Este es el camino que sigue un estudiante desde que lo escanea:

```
Escanea el QR del flyer → micompaz.com/?rol=compita#formulario
→ middleware.ts redirige (307, temporal) a /se-compita, sin pasar por Supabase
→ Ve la landing de reclutamiento (qué hace un Compita, beneficios, requisitos)
→ Llena el formulario (nombre, WhatsApp, email, estado y ciudad donde vive)
→ Se envía a /api/waitlist con "Rol: compa" en el campo Contacto
→ Queda registrado en Airtable, igual que los leads de la home
→ Airtable le manda un saludo automático con un preformulario
→ Cuando lo completa, el equipo lo llama por WhatsApp
→ CMC (Centro de Mando de Compitas, donde se gestiona la selección)
```

**Por qué /se-compita y no /compitas:** `/compitas` ya es el marketplace privado donde las familias con sesión iniciada eligen Compita. Está enlazado desde el dashboard, los emails, Telegram y el middleware, así que no se puede reutilizar para una página pública.

**Por qué es temporal la redirección:** el QR está impreso para siempre. Con una redirección 307 los navegadores no la guardan, y el destino se puede cambiar en el futuro sin reimprimir nada. `?rol=familia` y la home sin parámetro no se redirigen.

**Mismo formato que la home:** el formulario de `/se-compita` (lógica en `lib/postulaciones.ts`) envía exactamente los mismos campos que el formulario de la home. No hay que tocar Airtable ni sus automatizaciones para distinguir a los Compitas: basta con el texto "Rol: compa".

**Límite de envíos en /api/waitlist:**
- **50 envíos por IP por hora.** En el wifi de una universidad muchos estudiantes salen a internet con la misma IP; con un límite más bajo, solo los primeros podrían postularse.
- **1 envío por email por hora.** Evita postulaciones repetidas de la misma persona. Solo cuenta los envíos que se guardaron bien, así un fallo de Airtable no bloquea el reintento.
- Cloudflare Turnstile sigue siendo la defensa principal contra bots; estos límites son una capa extra y viven en memoria (cada instancia serverless lleva su propia cuenta).
