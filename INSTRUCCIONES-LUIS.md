# Instrucciones para Luis — Compaz

Hay tres cosas que hacer. La primera activa todos los cambios visuales y de copy en el sitio. La segunda blinda el formulario contra bots. La tercera protege el código fuente.

---

## Parte 1 — Publicar los cambios en micompaz.com

Todo el trabajo nuevo está en una rama del repositorio llamada `beta-simplificada`. Para publicarlo, hay que decirle a Netlify que use esa rama en vez de `main`.

### Pasos en Netlify

1. Ir a [app.netlify.com](https://app.netlify.com) e iniciar sesión
2. Seleccionar el sitio **compaz** (el de micompaz.com)
3. Ir a **Site configuration** → **Build & deploy** → **Branches and deploy contexts**
4. En el campo **Production branch**, cambiar `main` por `beta-simplificada`
5. Hacer clic en **Save**
6. Ir a la pestaña **Deploys**
7. Hacer clic en **Trigger deploy** → **Deploy site**
8. Esperar ~2 minutos hasta que aparezca **Published** en verde

Listo. micompaz.com mostrará el diseño nuevo con todos los cambios.

### Qué cambia en el sitio

- Nuevo hero con video de fondo, texto a la izquierda y botones a la derecha
- Titular en pregunta: *¿Tu mamá se quedó sin compañía para ir al médico, al banco, al mercado?*
- Dos botones: uno para familias y otro para postularse como Compita
- El segundo botón pre-selecciona automáticamente el rol "Compita" en el formulario
- Formulario con campos separados: nombre, WhatsApp, email, ciudad, y rol
- Secciones separadas por curvas (no líneas rectas), cada una con forma distinta
- Páginas internas eliminadas: `/inversionistas`, `/demo-marketplace` y `/compas` ya no existen y redirigen al inicio

---

## Parte 2 — Blindar el formulario antes de lanzar Meta Ads

Sin este paso, un bot puede enviar miles de inscripciones falsas y contaminar la lista de espera. Es el paso más importante antes de arrancar los anuncios.

### Paso A — Crear el widget en Cloudflare Turnstile

Turnstile es el sistema de Cloudflare que distingue personas reales de bots, sin mostrar CAPTCHAs molestos.

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) e iniciar sesión (o crear cuenta gratis)
2. En el menú izquierdo, buscar **Turnstile**
3. Hacer clic en **Add widget**
4. Completar:
   - **Widget name:** `Compaz Waitlist`
   - **Domains:** agregar `micompaz.com`
   - **Widget Mode:** Managed
5. Hacer clic en **Create**
6. Copiar las dos claves que aparecen:
   - **Site Key** (empieza con `0x...`) — va en el frontend
   - **Secret Key** (empieza con `0x...`) — va en el servidor, no compartir

### Paso B — Agregar las claves en Netlify

1. En Netlify → **Site configuration** → **Environment variables**
2. Hacer clic en **Add a variable** y agregar estas dos:

| Key | Value |
|-----|-------|
| `TURNSTILE_SITE_KEY` | La Site Key copiada de Cloudflare |
| `TURNSTILE_SECRET_KEY` | La Secret Key copiada de Cloudflare |

3. Ir a **Deploys** → **Trigger deploy** → **Deploy site**
4. Esperar a que termine el deploy

A partir de ese momento, cada envío del formulario será verificado por Cloudflare antes de llegar a Airtable. Los bots son bloqueados automáticamente.

---

---

## Parte 3 — Hacer el repositorio de GitHub privado

El repositorio en GitHub es actualmente **público**, lo que significa que cualquier persona en internet puede ver todo el código. Aunque las credenciales (Airtable, Turnstile) están guardadas en Netlify y no en el código, tener el repositorio público expone la lógica interna del sitio y facilita encontrar vulnerabilidades. Conviene cerrarlo.

### Por qué importa

Un repositorio público no expone contraseñas directamente, pero sí muestra cómo está construido el sistema de protección, qué validaciones tiene el formulario, y qué rutas existen. Esa información le ahorra trabajo a alguien con malas intenciones.

### Pasos en GitHub

1. Ir a [github.com](https://github.com) e iniciar sesión con la cuenta de Compaz
2. Abrir el repositorio **compaz-web**
3. Ir a la pestaña **Settings** (última opción del menú superior)
4. Bajar hasta la sección **Danger Zone** (al final de la página)
5. Hacer clic en **Change visibility** → **Change to private**
6. GitHub pedirá confirmar escribiendo el nombre del repositorio
7. Hacer clic en **I want to make this repository private**

Listo. El repositorio queda visible solo para los colaboradores con acceso.

> **Nota:** Esto no afecta para nada el funcionamiento del sitio en Netlify. Netlify ya tiene acceso autorizado al repositorio y seguirá desplegando normalmente aunque sea privado.

---

## Resumen de lo que queda activo tras estos pasos

| Protección | Estado |
|---|---|
| Rate limiting (máx. 3 intentos por hora por IP) | ✅ Ya en el código |
| Honeypot anti-bot (campo trampa oculto) | ✅ Ya en el código |
| CORS (solo acepta peticiones desde micompaz.com) | ✅ Ya en el código |
| Headers de seguridad (CSP, HSTS, X-Frame-Options…) | ✅ Ya en netlify.toml |
| Turnstile (verificación humana en tiempo real) | ⏳ Pendiente — Pasos A y B arriba |
| Rutas internas eliminadas | ✅ Ya en el código |
| Repositorio de GitHub privado | ⏳ Pendiente — Parte 3 arriba |
