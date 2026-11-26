# Bitácora de incidentes

Aquí se anota todo lo que salió mal en producción (o estuvo cerca): qué pasó, por qué, cómo se detectó, qué se cambió y qué queda pendiente. Sin buscar culpables: sirve para no repetirlo y para que quien herede el proyecto (un programador, un equipo) sepa qué se aprendió y por qué el código es como es.

Cómo se escribe cada entrada: impacto, línea de tiempo, causa raíz, detección, arreglo, qué queda pendiente y qué se aprendió. Lo que no se pudo comprobar se dice como tal. La entrada más nueva va arriba. El detalle de cada cambio de código está en `docs/versiones.md`.

---

## INC-003 · 24/25-nov-2026 · Producción dejó de actualizarse un día: la compilación de main fallaba

**Impacto.** El despliegue de producción de `main@0da369e` (1.4.1-beta.1) falló el 24-nov a las 22:17 (hora de Netlify). Producción se quedó en `main@cf6e0f8` (1.4.0) hasta que se publicó `main@3c1b16e`, el 25-nov a las 17:19 (hora de Netlify). Durante ese tiempo no hubo caída: el sitio publicado siguió funcionando, pero ninguno de los 38 cambios de 1.3.14 a 1.3.48 estaba en vivo. Cualquier rama que integrara main heredaba el fallo; así se detectó en el PR #26.

**Línea de tiempo.**
1. 24-nov, 22:17: falla el despliegue de producción de `main@0da369e`.
2. 25-nov, 14:29: falla el preview del PR #26 tras integrar main y se identifica la causa.
3. 25-nov, 19:05–19:07 (hora de Juan): Juan sube el arreglo y la actualización de Next a main.
4. 25-nov, 17:19 (hora de Netlify): producción publica `main@3c1b16e`.

**Causa raíz.** `components/panel/mas/VelocidadReal.tsx` es un componente del navegador (`'use client'`) que importaba constantes de `lib/velocidad-real.ts`. Ese módulo importa `lib/supabase-server.ts`, que usa `next/headers`, solo de servidor. Turbopack no permite ese módulo en el navegador y la compilación se detiene. `tsc` y las pruebas no lo detectan porque no compilan para el navegador.

**Detección.** Por el preview fallido del PR #26. Nadie recibió aviso del fallo de producción.

**Arreglo (lo hizo Juan en `main`, 25-nov).**
- `3685e98`: separa `lib/velocidad-real.ts` (pura, la usa el navegador) de `lib/velocidad-real-servidor.ts` (guardar y leer).
- `3c1b16e`: actualiza Next de 16.4.3 a 16.4.6. `next build` 16.4.3 también se detenía por avisos de seguridad conocidos.
- Producción publicó `main@3c1b16e` el 25-nov, con las versiones 1.3.14 a 1.3.48 y 1.4.1 juntas.
- En paralelo se había preparado un arreglo alternativo (PR #27 y una versión previa del PR #26). Se descartó para no duplicar el de Juan: el PR #27 se cerró sin fusionar y el PR #26 adopta los archivos de `main`.

**Hecho.** La prueba 144 (PR #26) falla si un archivo con `'use client'` importa, directa o indirectamente, `lib/supabase-server.ts`. Se comprobó que detecta el error original y que pasa con el arreglo de Juan.

**Pendiente.**
1. Activar en Netlify un aviso de despliegue fallido (*Deploy notifications → Deploy failed*), por correo o Telegram.
2. Los cambios a `main` pasan por un PR con su preview antes de fusionarse. Los 38 cambios de 1.3.14 a 1.3.48 entraron directo y nunca se vieron compilar hasta su publicación.

**Qué se aprendió.** `tsc` y las pruebas en verde no garantizan que compile. Antes de fusionar a main hay que mirar el estado del preview.

---

## INC-002 · 17-nov-2026 · Una lluvia de consultas desde el panel dejó sin acceso a dos conexiones

**Impacto.** Dos navegadores con el panel abierto (el de Juan, Mac, y el de Luis, Windows) hicieron cerca de 35.000 consultas en una hora a `/api/admin/pendientes-bandeja` y unas 2.600 a `/api/admin/pendientes-pagos` (unas 5 por segundo cada uno). Lo normal en todo el sitio son unas 60 peticiones por hora. Después de eso, el sitio dejó de abrirse desde esas dos conexiones (la conexión se corta al empezar). Para el resto, el sitio siguió funcionando: los procesos programados respondían 200 y el despliegue estaba "ready". Los clientes no se vieron afectados hasta donde se pudo comprobar.

**Línea de tiempo (UTC).**
1. 01:00 a 02:00 del 17-nov: el pico (35.692 respuestas 200 y 2.031 respuestas 499 en esa hora; la hora anterior y la siguiente, normales).
2. Más tarde ese día: Juan reporta que la web "está caída". Se comprueba que mi propia conexión (la misma IP de Juan, `186.106.55.229`) es la que más peticiones hizo y que no puede abrir el sitio, mientras que Netlify lo ve sano.

**Causa raíz.** En `components/panel/InsigniaPendiente.tsx` la función de suscripción de `useSyncExternalStore` era una flecha nueva en cada dibujo. React se desuscribía y volvía a suscribirse en cada dibujo; al quedar sin suscriptores, `components/panel/pendientes-store.ts` borraba el número, y al volver a suscribirse consultaba al servidor y recuperaba el número, lo que forzaba otro dibujo. Un bucle sin fin mientras el panel estuviera abierto, sin que nadie tocara nada. El error entró con el punto rojo del menú (versión 1.1.x) y pasó desapercibido porque solo daña cuando alguien deja el panel abierto un buen rato, y porque ninguna prueba abría un componente real.

**Detección.** La detectó una persona al ver que no abría. Ninguna alarma saltó. Se encontró con las métricas de solicitudes de Netlify (por URL, por dirección y por agente de usuario).

**Arreglo (versión 1.3.9-beta.1).** Tres capas: (a) la suscripción es estable con `useCallback`; (b) el almacén nunca consulta más de una vez cada 5 segundos por pestaña, junta las repetidas y no lanza otra si ya hay una en camino; (c) la prueba `tests/113-punto-rojo-sin-bucle.test.ts` reproduce el bucle (50 suscripciones seguidas = una consulta) y falla con la lógica vieja.

**Qué no se pudo comprobar.**
1. Cuántos créditos de Netlify se gastaron. Esas 35.000 ejecuciones pueden ser poco o mucho según el plan; hay que mirar Usage en Netlify.
2. Que el bloqueo de las dos conexiones sea una protección automática de Netlify. Es la explicación más probable, pero es una deducción.
3. Que el arreglo se comporte bien en el navegador real: la prueba cubre el almacén y la forma del componente, no el dibujo en pantalla.

**Hecho.** 1. Arreglo publicado (1.3.9, commit `8580d19`). 2. Tope en el servidor y alarma de tráfico anormal por persona y ruta (1.3.10, `lib/guardia-trafico.ts`): 30 consultas por minuto, 429 explicado y aviso urgente una vez por hora.

**Pendiente (por orden).**
1. En Netlify, por quien administra la cuenta: alerta de uso, tope de gasto y revisar Usage para saber cuántos créditos se gastaron. El tope del código protege la base de datos y avisa, pero la función de Netlify igual se ejecuta en cada petición.
2. DECIDIDO NO HACERLO POR AHORA (17-nov): cambiar el sondeo de 20 segundos por avisos en tiempo real. Para un equipo de 2 a 5 personas el sondeo (con el error arreglado y los topes) cuesta unas 3 consultas por minuto por persona, y el tiempo real añade piezas que pueden fallar sin avisar (tabla, disparadores, permisos, conexión en vivo). El trabajo ya hecho (versiones 1.3.14 y 1.3.15, migración `20261117c_panel_senales.sql`, interruptor `panel_tiempo_real` apagado) queda guardado sin publicar en la rama `auditoria/acumulado-7` por si el equipo crece. Criterio para retomarlo: más de unas 10 personas con el panel abierto o un costo de ejecuciones que moleste.
3. Auditoría de resiliencia completa: `docs/auditoria-resiliencia-prompt.md`.

**Qué se aprendió.**
1. Una prueba que cuenta llamadas al servidor se escribe para todo lo que consulta en intervalos.
2. Antes de publicar algo que sondea, se deja la pantalla abierta 5 minutos con la pestaña Red del navegador y se cuentan las peticiones.
3. Defensa en capas: causa raíz, tope en el cliente, tope en el servidor y alarma. Ninguna sola basta.

---

## INC-001 · 16-nov-2026 · «Este compita no está disponible» al contratar por segunda vez

**Impacto.** Un cliente no podía contratar de nuevo a su compita: la pantalla decía «no está disponible» sin más explicación.

**Causa raíz.** El compita había reportado al cliente pidiendo no volver con él (en Telegram), y eso creó un bloqueo (`bloqueos_compita_cliente`). La llamada del equipo se cerró como «Resuelto», que NO levanta el bloqueo. El bloqueo quedó activo y escondido: el cliente solo ve «no está disponible» (a propósito, sin el motivo) y el panel no tenía ninguna pantalla para verlo ni levantarlo (la ruta existía, pero ningún botón).

**Detección.** La reportó Juan al probar una segunda contratación. Se diagnosticó con consultas de solo lectura a la base.

**Arreglo (versión 1.2.5-beta.1).** El bloqueo se ve y se levanta desde la ficha del compita y la del cliente («No vuelven a trabajar juntos» con «Levantar el bloqueo»). La llamada del equipo ya no se puede cerrar como «Resuelto» ni «Hablar con el cliente» si hay un bloqueo activo, y el servidor lo exige (409). El bloqueo de ese caso se levantó con autorización de Juan.

**Qué se aprendió.** Todo estado que impide algo al usuario debe poder verse y revertirse desde el panel. Si una ruta existe pero ninguna pantalla la usa, es una funcionalidad que no existe.

---

## Notas de proceso (no son incidentes, pero conviene saberlo)

1. **Publicación directa a `main`.** Varias veces se publicó con `git push origin <rama>:main` usando el permiso de administrador, que se salta la regla de GitHub «los cambios deben entrar por un pull request». Se hizo a propósito (un solo despliegue, para ahorrar créditos), pero implica que la prueba automática (`verificar`) corre DESPUÉS de publicar y que Netlify no la espera. Si entra un programador, conviene cerrar ese atajo.
2. **Base de datos compartida.** Local y producción usan la misma base de Supabase (`compaz-prod`). Toda migración debe ser aditiva (solo agrega) y se aplica antes de publicar el código que la usa. Ver `CLAUDE.md`, sección «Datos y respaldo antes de abrir al público».
3. **El proyecto de Supabase archivado** (`qrhkzlzblaknzsxqfney`) no se toca.
