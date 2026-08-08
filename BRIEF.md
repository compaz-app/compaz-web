# Compaz — Brief para Luis (Beta Launch)

## Contexto del proyecto

Compaz es una plataforma de cuidado por compañía para adultos mayores en Venezuela, pagada por hijos y familiares en el exterior. Es un proyecto en etapa pre-lanzamiento. Este es el código del sitio web de marketing (`elcompaz.com`), construido en **Next.js** con **Tailwind CSS v4**, y desplegado en **Netlify**.

El sitio ya está funcional y diseñado. Tu trabajo es prepararlo para un **lanzamiento beta en vivo** antes del **15 de agosto de 2026**.

---

## Tu misión

### Objetivo principal
Convertir la landing page actual (larga, exploratoria) en una **versión beta concisa** cuyo único objetivo es que personas se inscriban en la lista de espera.

El éxito se mide con una sola métrica: **inscripciones en la lista de espera**. Con esa tracción podemos demostrar validación del concepto a inversionistas.

### Qué hacer
1. **Acortar el contenido de la página principal** — Mantener solo las secciones esenciales para que alguien entienda la propuesta, confíe, y se inscriba. La creencia que hay que construir en ese orden:
   - El problema es real (la familia está lejos, no sabe cómo están)
   - Compaz es confiable (Compas verificados, hay un equipo detrás)
   - El servicio funciona (cómo funciona, claro y simple)
   - Únete ahora (CTA de lista de espera — formulario)

2. **El formulario de lista de espera es el CTA central** — Debe ser visible, claro, y funcionar. Actualmente el formulario envía a Airtable via `/api/waitlist`. Necesita estar conectado y probado.

3. **Mantener la página `/inversionistas`** — No tocarla, no rediseñarla. Solo asegurarse de que no esté indexada por buscadores (ya tiene `robots: noindex`).

4. **Mantener el diseño exactamente como está** — El sistema visual (colores, fuentes, componentes) está definido en `DESIGN.md` y documentado en `Compaz_Manual_de_Estilo.html`. No inventar nuevos patrones. No cambiar colores. No cambiar fuentes.

### Qué NO hacer
- No rediseñar. Solo editar contenido y estructura de secciones.
- No agregar secciones nuevas.
- No cambiar la paleta de colores, tipografía, ni componentes existentes.
- No exponer claves de API en el frontend.
- No tocar `/inversionistas/page.tsx` salvo que haya un bug de seguridad.

---

## Stack técnico

| Tecnología | Versión | Notas |
|---|---|---|
| Next.js | 15.x | App Router. Lee `node_modules/next/dist/docs/` antes de escribir cualquier código. El AGENTS.md del proyecto lo requiere explícitamente. |
| Tailwind CSS | v4 | API de configuración diferente a v3 — no usar `tailwind.config.js`, los tokens van en `globals.css`. |
| TypeScript | 5.x | Strict mode. |
| Deploy | Netlify | Ver `netlify.toml`. La build genera `out/` via `next export`. |
| Base de datos de lista de espera | Airtable | Via API REST. Credenciales en variables de entorno. |

---

## Variables de entorno requeridas

Crear un archivo `.env.local` en la raíz del proyecto con:

```
AIRTABLE_API_KEY=tu_clave_aqui
AIRTABLE_BASE_ID=tu_base_id_aqui
AIRTABLE_TABLE_NAME=Lista de Espera
```

El endpoint `/api/waitlist` ya existe en `app/api/waitlist/route.ts` y funciona. Solo necesita las variables de entorno configuradas.

**En Netlify:** configurar las mismas variables en el dashboard de Netlify (Site settings → Environment variables). Nunca hardcodear las claves en el código.

---

## Seguridad — Obligatorio antes del lanzamiento

El sitio va a recibir tráfico de publicidad paga. Antes de publicar en vivo, el agente que construye debe verificar y resolver estos puntos:

### 1. Rate limiting en el endpoint de lista de espera
El endpoint `/api/waitlist/route.ts` no tiene rate limiting. Con publicidad paga, es vulnerable a spam y a cargos excesivos en Airtable.
- Implementar rate limiting por IP: máximo 3 intentos por IP por hora.
- Opción recomendada: usar el middleware de Next.js o una librería como `@upstash/ratelimit` (requiere cuenta Upstash) o implementar un simple contador en memoria con `Map` para Netlify Functions.

### 2. Validación y sanitización de inputs
El endpoint actual acepta cualquier string sin sanitizar. Agregar:
- Longitud máxima por campo (nombre: 100 chars, contacto: 200 chars, ciudad: 100 chars).
- Validación de formato en el campo de email/teléfono (actualmente llamado `contacto`).
- Strip de HTML/scripts en los valores antes de enviarlos a Airtable.

### 3. Headers de seguridad HTTP
Configurar en `netlify.toml` o en `next.config.ts`:
- `X-Frame-Options: DENY` — evita clickjacking.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — al menos bloquear inline scripts externos no autorizados.

### 4. No exponer variables de entorno al cliente
Verificar que ninguna variable de Airtable empiece con `NEXT_PUBLIC_`. Si empieza con `NEXT_PUBLIC_`, es visible en el bundle del browser. Las claves de Airtable deben ser solo server-side.

### 5. La página `/inversionistas` no debe ser descubrible
- Ya tiene `robots: { index: false, follow: false }` en los metadatos.
- Verificar que `netlify.toml` no la exponga en el sitemap.
- No linkear a ella desde ningún lugar público excepto el footer (donde ya aparece de forma discreta).

### 6. HTTPS only
Verificar en Netlify que el redirect HTTP → HTTPS esté activo. Es el default en Netlify pero confirmar que no haya configuración que lo deshabilite.

---

## Archivos clave

| Archivo | Qué es |
|---|---|
| `app/page.tsx` | Landing page principal — aquí es donde se trabaja la mayor parte |
| `app/globals.css` | Tokens CSS y animaciones (`arrow-bounce`, `wavy-underline`) |
| `app/layout.tsx` | Fonts (Bricolage Grotesque + Inter), metadata global |
| `app/inversionistas/page.tsx` | Página para inversionistas — no tocar |
| `app/api/waitlist/route.ts` | Endpoint de lista de espera → Airtable |
| `DESIGN.md` | Sistema de diseño completo — leer antes de cualquier cambio visual |
| `PRODUCT.md` | Contexto de producto, a quién le habla el sitio, belief ladder |
| `Compaz_Manual_de_Estilo.html` | Manual de marca visual — abrir en el browser para referencia |
| `netlify.toml` | Configuración de deploy |
| `.env.example` | Variables de entorno requeridas |

---

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo en localhost:3000
npm run build        # generar out/ para Netlify
```

---

## Deadline

**15 de agosto de 2026.** El sitio debe estar en vivo en Netlify con el formulario funcional y los puntos de seguridad resueltos antes de esa fecha.

---

## Pregunta de cierre para el agente

Antes de terminar, el agente debe responder explícitamente:
1. ¿Qué secciones de `page.tsx` eliminé y por qué?
2. ¿Cuáles de los 6 puntos de seguridad implementé y cómo los verifiqué?
3. ¿El formulario está probado end-to-end (input → Airtable)?
