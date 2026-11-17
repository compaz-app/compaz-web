# Pendientes (anotados el 17-nov-2026 para el 18-nov)

Estado al cerrar el 17-nov: `main` en `194a3ad` (versión 1.3.13-beta.1). Lo que se publicó hoy: portal del cliente completo (fases 1 a 3, mensajes sin leer, campana), arreglo del incidente INC-002, perfil público obligatorio para Telegram y para verificar compitas, Airtable fuera del código, política de privacidad corregida. Detalle de cada cambio en `docs/versiones.md`; incidentes en `docs/incidentes.md`.

## Tuyos (Juan y Luis), por orden

1. **Comprobar el despliegue.** En Netlify, proyecto `compaz-beta`, el último despliegue de producción debe decir `main@194a3ad` y "Published". En el panel, la versión (abajo del menú) debe decir 1.3.13-beta.1.
2. **Postulación de prueba (lo más importante).** Enviar una postulación desde la página pública y comprobar que aparece en Más, Postulaciones y origen. Es lo único que cambió en un formulario que usa gente de afuera.
3. **Revisar `/privacidad`.** Ahora dice «Tus datos se almacenan en Supabase». Es un texto legal: confirmar que está bien.
4. **Netlify, créditos.** Mirar Usage del 17-nov para saber cuánto costó el bucle (35.000 ejecuciones). Configurar alerta de uso y tope de gasto. Quitar las variables `AIRTABLE_*` y `POSTULACIONES_DESTINO`. Revocar la clave de Airtable.
5. **Script del CMC.** Luis confirma que usa `CMC_FUENTE=supabase` (ya no hay respaldo en Airtable).
6. **Acceso bloqueado.** Si la conexión de Juan (`186.106.55.229`) sigue sin abrir el sitio, probar con datos del teléfono. Si persiste, revisar en Netlify (bloqueo por exceso de peticiones tras el bucle).
7. **Comprobar el arreglo del bucle.** Abrir el panel 5 minutos con la pestaña Red del navegador: deben verse unas 3 consultas por minuto por punto rojo, no cientos.
8. **Revisar el portal del cliente con ojos.** Nada de lo del portal se vio en pantalla (chat con marco, recorrido, tarjeta de siguiente paso, Mi cuenta, campana, círculos rojos, paso a «agendar otra» al ver el reporte). Iniciar sesión en el navegador del panel de Claude (`http://localhost:3000/login`) o probar como cliente de prueba en `micompaz.com`.
9. **Dos compitas con perfil vacío.** Mauricio Acacio y María Alejandra Navarro siguen vinculados a Telegram sin descripción ni servicios y no se pueden verificar hasta que llenen el perfil (`/perfil` en Telegram o el enlace del correo).
10. **`CORREO_RESPALDO=diferido`.** Sigue apagado (los correos salen al instante). Encenderlo en Netlify solo después de probar el portal en vivo con una visita real.
11. **Decisión de proceso.** Hoy se publica directo a `main` saltando la regla de PR (el CI corre después). Decidir si se cierra ese atajo (exigir PR y que `verificar` pase) y asumir el costo extra de créditos.
12. **Dependabot.** Una vulnerabilidad moderada (#62) sigue abierta.

## De Claude, cuando des luz verde

1. **Auditoría de resiliencia y costos.** El prompt está en `docs/auditoria-resiliencia-prompt.md` (6 partes; pegar en una sesión nueva). Empieza por el inventario de todo lo que se ejecuta solo.
2. **Subir el commit de la bitácora** (`b38ba7c`, solo documentación), que quedó local.
3. **Tiempo real del panel: en pausa.** Está hecho y guardado sin publicar en la rama `auditoria/acumulado-7` (versiones 1.3.14 y 1.3.15, migración `20261117c_panel_senales.sql` SIN aplicar, interruptor `panel_tiempo_real` apagado). Retomar si el equipo pasa de unas 10 personas con el panel abierto o el costo molesta.
4. **Portal del cliente, siguiente nivel.** Alertas por horas de silencio y preferencias, métricas, teléfono con país en las otras formas (ficha, registro de compita, postulación) y pasar los demás correos por `notificar()`. Ver `docs/ciclo-comunicaciones.md`.
5. **Antes de abrir al público** (de `CLAUDE.md`): Stripe, texto legal provisional de los términos, copias de seguridad, separar la base de desarrollo de la de producción, claves de Turnstile.
