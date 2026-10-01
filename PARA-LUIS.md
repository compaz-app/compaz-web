# Para Luis — Cambios pendientes de publicar

Hay dos PRs abiertos en GitHub que hay que mergear para que los cambios aparezcan en micompaz.com.

---

## Paso 1 — Mergear PR #3 (Seguridad)

**Antes de hacer esto, configura las claves de Turnstile en Netlify** (ver abajo). Si mergeas sin las claves, el formulario bloqueará a todos los usuarios reales.

### Configurar Turnstile primero

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add widget**
2. Nombre: `Compaz`, dominio: `micompaz.com`, tipo: **Managed**
3. Copiar el **Site Key** y el **Secret Key**
4. En Netlify → **Site configuration** → **Environment variables**, agregar:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key de Cloudflare |
| `TURNSTILE_SECRET_KEY` | Secret Key de Cloudflare |

5. Hacer deploy en Netlify para que las variables queden activas

### Luego mergear

Ir a [github.com/compaz-app/compaz-web/pull/3](https://github.com/compaz-app/compaz-web/pull/3) → **Merge pull request**

Qué incluye este PR:
- Turnstile fail-closed: si falta la clave en producción, el formulario rechaza envíos en vez de dejarlos pasar
- Headers de seguridad (CSP, HSTS, X-Frame-Options) aplicados correctamente a todas las páginas

---

## Paso 2 — Mergear PR #4 (Diseño + copy)

Ir a [github.com/compaz-app/compaz-web/pull/4](https://github.com/compaz-app/compaz-web/pull/4) → **Merge pull request**

Qué incluye este PR:
- Nueva sección "Diseñado para que confíes" entre el Hero y los servicios
- Texto del piloto corregido: "Venezuela" en vez de "Caracas"

---

## Paso 3 — Hacer el repositorio privado

1. Ir a [github.com/compaz-app/compaz-web/settings](https://github.com/compaz-app/compaz-web/settings)
2. Bajar hasta **Danger Zone** → **Change visibility** → **Change to private**
3. Confirmar escribiendo el nombre del repositorio

Esto oculta el código fuente y el historial de git (que incluye las páginas de inversores eliminadas).

---

## Prompt para el Claude de Luis

Si quieres que Claude te ayude con algo pendiente, pega este prompt:

```
Soy Luis, co-founder de Compaz. Estoy trabajando en el repositorio compaz-app/compaz-web.

Contexto:
- Landing page en Next.js desplegada en Netlify en micompaz.com
- Hay dos PRs mergeados recientemente (#3 seguridad, #4 diseño)
- Turnstile de Cloudflare está configurado en Netlify con las claves NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY
- El footer del sitio tiene un enlace a /privacidad que devuelve 404
- Meta Pixel está activo, lo que significa que necesitamos una página de privacidad antes de lanzar Meta Ads

Tarea: Crea la página /privacidad en app/privacidad/page.tsx. Debe:
- Explicar qué datos recolectamos (nombre, WhatsApp, email, ciudad)
- Mencionar que usamos Meta Pixel para publicidad
- Mencionar Airtable como sistema donde se guardan los datos
- Tener un email de contacto: hola@micompaz.com
- Usar el mismo diseño del resto del sitio (fondo #FDFAF6, tipografía Bricolage Grotesque para títulos, Inter para cuerpo, color primario #2D1464)
- Ser simple y legible, no legal compleja
```

---

## Resumen de estado

| Tarea | Estado |
|---|---|
| PR #3 — Seguridad (Turnstile fail-closed + headers) | ⏳ Pendiente merge |
| PR #4 — Diseño + copy Venezuela | ⏳ Pendiente merge |
| Turnstile claves en Netlify | ⏳ Pendiente configurar |
| Repositorio GitHub privado | ⏳ Pendiente |
| Página /privacidad | ⏳ Pendiente crear |
