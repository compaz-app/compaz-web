# Demo para inversionistas (pendiente: se hará más adelante, decidido 2026-11-12)

**Objetivo:** que un inversionista vea el sistema completo (administrador, cliente y compita) sin que haya que armar cuentas ni flujos falsos cada vez, y sin tocar datos reales de personas mayores y sus familias.

**Decisión:** se hará el **entorno de demostración del sistema real, de solo lectura** (opción 3 de la conversación). No se hace todavía. Complementos de menor esfuerzo, sin fecha: un recorrido grabado de 5 a 8 minutos y refrescar el prototipo de `app/prototipo` (hoy oculto en producción; se enciende con `PROTOTIPO_VISIBLE=1`).

## Cómo será
1. **Entorno aparte.** Un proyecto de Supabase propio solo para la demo, con datos ficticios, y su propio despliegue en Netlify. Es el mismo "proyecto de pruebas" que pide la auditoría O-01 (`docs/entorno-de-pruebas-y-respaldos.md`): conviene crearlos juntos. **Nunca** se enseña la base de producción.
2. **Datos de ejemplo repetibles.** Un script de siembra (clientes, compitas, visitas en distintas etapas, pagos, reseñas, postulaciones, avisos, equipo) que deja la demo siempre igual y se puede volver a correr (por ejemplo cada noche).
3. **Modo solo lectura.** Una variable de entorno (por ejemplo `MODO_DEMO=1`) solo en ese despliegue: toda acción que cambie algo responde con un mensaje claro ("Modo demostración: esta acción no se ejecuta") y la pantalla muestra un banner "Datos de ejemplo". Se aplica en un único lugar (la guardia de permisos y las rutas que no pasan por ella), y una prueba de guardia verifica que ninguna ruta que escribe se quede fuera.
4. **Cada botón explicado.** Ya está resuelto: todo botón del panel lleva su ⓘ (prop `info` de `Boton`).
5. **Entrada con un clic.** Página `/demo` con tres botones: ver como administrador, como cliente (portal nuevo) y como compita. Solo existe en el despliegue de demo (variable de entorno) y usa cuentas de ejemplo sin datos reales.
6. **Un enlace por inversionista**, con vencimiento, que registra quién lo abrió y cuándo, para dar seguimiento.
7. **El lado compita** vive en Telegram y no se puede simular con una sesión web: se resuelve con una pantalla de chat simulado (a partir del prototipo) y capturas del bot real.

## Lo que ya existe y se reutiliza
- Panel completo con ⓘ en cada acción; "ver como colaborador" (`?como=colaborador`); portal nuevo del cliente (`/portal`); manual del equipo.
- Prototipo con datos falsos en `app/prototipo/*` (admin, cliente, compita, ciclo y recorrido).

## Esfuerzo estimado
Entre un día y día y medio una vez exista el proyecto de pruebas. Ver también `docs/auditoria-2026-11-11.md` (O-01).
