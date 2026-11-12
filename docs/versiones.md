# Historial de versiones

La versión vigente está en `lib/version.ts` y se ve en el panel (menú lateral, abajo; en el teléfono, arriba junto al título). Se sube cuando entra algo relevante y se anota aquí, la más nueva primero.

Reglas: mayor = cambio grande o lanzamiento; menor = función nueva; parche = arreglo. La etapa `beta` sale cuando el sistema corre una o dos semanas con uso real sin sorpresas.

## 1.0.0-beta.1 (2026-11-12)
Primera versión completa del panel nuevo `/panel` (sustituye al `/admin` viejo).
1. Panel con datos reales: Bandeja, Personas, Seguimiento, Visitas y Más (reseñas, pagos, avisos, cobertura, equipo y permisos, ajustes, postulaciones y origen (CMC), invitar, actividad, registro de accesos, límites, manual, estado).
2. Ajustes conectados, llamadas en sala incrustada con aviso de fin, esperas explicadas y permisos por colaborador.
3. Dos rondas de auditoría resueltas, rendimiento del Seguimiento, validación de correos y eliminar cuenta conservando el historial.
4. Líneas de servicio futuras como "Próximamente" y sección "Cuidador de mascotas" en el perfil del compita.
5. Emojis solo en Telegram y en las estrellas de calificación.
6. Incluye la integración de CMC desde Supabase de Luis.

Pendiente para salir de beta: probar Telegram, llamadas y avisos en vivo; Stripe; texto legal; claves de Turnstile; base de pruebas separada y respaldos.
