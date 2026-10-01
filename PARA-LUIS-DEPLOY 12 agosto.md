# Para Luis — Publicar cambios en micompaz.com

Hay dos PRs listos en GitHub. Hazlos en orden.

---

## ⚠️ Antes de mergear — tu foto de perfil

El PR #4 solo modifica el archivo `app/page.tsx`. **No toca ninguna imagen.** Tu foto actualizada en `/public/images/luis-mendoza.jpg` debe quedar intacta después del merge.

Sin embargo, después de mergear y que Netlify despliegue, verifica que tu foto aparezca correctamente en la sección del equipo en micompaz.com. Si por alguna razón desapareció (muy poco probable), puedes volver a subir el archivo de imagen directamente desde GitHub:

1. En el repositorio → carpeta `public/images/`
2. Clic en **Add file** → **Upload files**
3. Sube tu foto y nómbrala exactamente `luis-mendoza.jpg`
4. Commit directo a `main`

---

## Paso 1 — Mergear PR #3 (Seguridad)

⚠️ **Configura las claves de Turnstile en Netlify ANTES de mergear.** Sin ellas, el formulario bloqueará a todos los usuarios reales en producción.

### Configurar Turnstile primero

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add widget**
2. Nombre: `Compaz`, dominio: `micompaz.com`, tipo: **Managed**
3. Copiar el **Site Key** y el **Secret Key**
4. En Netlify → **Site configuration** → **Environment variables**, agregar:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key de Cloudflare |
| `TURNSTILE_SECRET_KEY` | Secret Key de Cloudflare |

5. Guardar y hacer un deploy en Netlify para activar las variables

### Luego mergear

→ [github.com/compaz-app/compaz-web/pull/3](https://github.com/compaz-app/compaz-web/pull/3) → **Merge pull request**

Qué incluye:
- Turnstile fail-closed: sin clave en producción el formulario rechaza envíos
- Headers de seguridad (CSP, HSTS, X-Frame-Options) en todas las páginas

---

## Paso 2 — Mergear PR #4 (Diseño + contenido)

→ [github.com/compaz-app/compaz-web/pull/4](https://github.com/compaz-app/compaz-web/pull/4) → **Merge pull request**

Qué incluye:

**Copy actualizado:**
- Hero: nuevo subtítulo que enfatiza el equipo verificado
- Sección de confianza: nuevo título y los 3 pilares reescritos y más cortos
- Sección de servicios: nuevo título + subtítulo de verificación
- Cómo funciona, paso 2: enfatiza que el equipo elige al Compita
- Sección del equipo: párrafo introductorio sobre los fundadores
- Formulario: texto sobre el límite de 50 familias
- Texto de Venezuela en el piloto (antes decía Caracas)

**Contenido nuevo:**
- Sección "Diseñado para que confíes" entre el Hero y los servicios
- Video de Juan en la sección del equipo (desktop: al lado de las bios; móvil: debajo)
- Sección de preguntas frecuentes con 7 preguntas al final de la página, después del formulario

---

## Paso 3 — Verificar en Netlify

Después de cada merge, Netlify despliega automáticamente (~2 minutos).

→ [app.netlify.com](https://app.netlify.com) → sitio **compaz** → pestaña **Deploys** → esperar **Published** en verde

**Checklist de verificación post-deploy:**
- [ ] Tu foto aparece en la sección del equipo
- [ ] El formulario acepta envíos (Turnstile configurado)
- [ ] La sección de FAQ aparece al final de la página
- [ ] El video de Juan se ve en la sección del equipo

---

## Paso 4 — Hacer el repositorio privado

1. Ir a [github.com/compaz-app/compaz-web/settings](https://github.com/compaz-app/compaz-web/settings)
2. Bajar hasta **Danger Zone** → **Change visibility** → **Change to private**
3. Confirmar escribiendo el nombre del repositorio

Esto no afecta el deploy en Netlify.

---

## Si quieres que Claude te ayude con algo más

Pega este prompt en tu Claude:

```
Soy Luis, co-founder de Compaz. Trabajo en el repositorio compaz-app/compaz-web (Next.js + Netlify, desplegado en micompaz.com).

Los PRs #3 y #4 ya están mergeados en main. Turnstile está activo con claves en Netlify.

Queda pendiente crear la página /privacidad en app/privacidad/page.tsx.
El footer del sitio ya enlaza a esa ruta pero devuelve 404. Meta Pixel está activo, así que necesitamos esta página antes de lanzar Meta Ads.

La página debe:
- Explicar qué datos recolectamos: nombre, WhatsApp, email, ciudad
- Mencionar que usamos Meta Pixel para publicidad
- Mencionar Airtable como sistema de almacenamiento
- Incluir email de contacto: hola@micompaz.com
- Usar el diseño del sitio: fondo #FDFAF6, color primario #2D1464, naranja #FF6B2B,
  Bricolage Grotesque para títulos, Inter para cuerpo
- Ser simple y legible, sin jerga legal
```

---

## Estado tras estos pasos

| Tarea | Estado |
|---|---|
| PR #3 — Seguridad | ⏳ Pendiente merge |
| PR #4 — Diseño + contenido | ⏳ Pendiente merge |
| Turnstile claves en Netlify | ⏳ Pendiente configurar |
| Verificar foto de Luis post-merge | ⏳ Pendiente verificar |
| Repositorio GitHub privado | ⏳ Pendiente |
| Página /privacidad | ⏳ Pendiente crear |
