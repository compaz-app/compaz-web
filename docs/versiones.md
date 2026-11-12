# Historial de versiones

La versión vigente está en `lib/version.ts` y se ve en el panel (menú lateral, abajo; en el teléfono, arriba junto al título). Se sube cuando entra algo relevante y se anota aquí, la más nueva primero.

Reglas: mayor = cambio grande o lanzamiento; menor = función nueva; parche = arreglo. La etapa `beta` sale cuando el sistema corre una o dos semanas con uso real sin sorpresas.

## 1.1.0-beta.1 (2026-11-12)
Integración del CMC de Luis con el panel nuevo, en un solo sistema.
1. La ficha del compita muestra su estado en el CMC: ID COM-, si el CMC lo permite, último cambio y lo que le falta para recibir solicitudes.
2. Si el CMC no permite a un compita, el panel no deja verificarlo ni activarlo (el servidor también lo rechaza); quitar la verificación o desactivar siempre se puede.
3. La alta manual y la invitación por enlace no duplican un perfil que ya existe desde el CMC.
4. Entra la rama `feat/cmc-compitas`: ruta `POST /api/cmc/compitas`, sincronización de compitas habilitadas, guardas de `cmc_permite` en solicitudes y asignaciones, y vigilancia de la foto horaria.
5. El panel viejo no vuelve: lo que Luis había puesto en el dashboard viejo ahora vive en la ficha del panel nuevo.

## 1.0.0-beta.1 (2026-11-12)
Primera versión completa del panel nuevo `/panel` (sustituye al `/admin` viejo).
1. Panel con datos reales: Bandeja, Personas, Seguimiento, Visitas y Más (reseñas, pagos, avisos, cobertura, equipo y permisos, ajustes, postulaciones y origen (CMC), invitar, actividad, registro de accesos, límites, manual, estado).
2. Ajustes conectados, llamadas en sala incrustada con aviso de fin, esperas explicadas y permisos por colaborador.
3. Dos rondas de auditoría resueltas, rendimiento del Seguimiento, validación de correos y eliminar cuenta conservando el historial.
4. Líneas de servicio futuras como "Próximamente" y sección "Cuidador de mascotas" en el perfil del compita.
5. Emojis solo en Telegram y en las estrellas de calificación.
6. Incluye la integración de CMC desde Supabase de Luis.

Pendiente para salir de beta: probar Telegram, llamadas y avisos en vivo; Stripe; texto legal; claves de Turnstile; base de pruebas separada y respaldos.
