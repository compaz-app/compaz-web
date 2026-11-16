# Historial de versiones

La versión vigente está en `lib/version.ts` y se ve en el panel (menú lateral, abajo; en el teléfono, arriba junto al título). Se sube cuando entra algo relevante y se anota aquí, la más nueva primero.

Reglas: mayor = cambio grande o lanzamiento; menor = función nueva; parche = arreglo. La etapa `beta` sale cuando el sistema corre una o dos semanas con uso real sin sorpresas.

## 1.2.6-beta.1 (2026-11-16)
Portal del cliente, fase 1: siguiente paso en todas las pestañas y círculo rojo en Visitas.
1. La tarjeta «qué pasa y qué sigue» ya no solo está en Inicio: aparece arriba en Visitas, Mi familiar y Mi plan.
2. La tarjeta dice en una frase qué viene después de ese paso («Después: tu compita confirma la hora»).
3. Un círculo rojo con número en la pestaña Visitas cuenta lo nuevo que aún no abriste. Se quita al entrar a Visitas. Que el portal estuviera abierto no lo quita. El equipo en vista previa no lo marca.
4. Sin migración (usa la columna `actuada_en` que ya existía).

## 1.2.5-beta.1 (2026-11-16)
El bloqueo «este compita no vuelve con este cliente» se ve y se levanta desde la ficha (hallazgo 17 de la auditoría de flujos).
1. Causa de «Este compita no está disponible» al contratar por segunda vez: el compita había reportado al cliente pidiendo no volver con él (en Telegram), eso creó un bloqueo, y la llamada del equipo se cerró como «Resuelto», que NO lo levanta. El bloqueo quedó activo y escondido: el cliente solo ve «no está disponible» (a propósito, sin el motivo), y el panel no tenía ninguna pantalla para verlo ni levantarlo (existía la ruta, pero ningún botón).
2. Ahora, en la ficha del compita y en la del cliente, aparece «No vuelven a trabajar juntos» con el nombre del otro, desde cuándo y el botón «Levantar el bloqueo» (con confirmación y ⓘ). Solo lo ve quien puede atender.
3. La llamada del equipo ya no se puede cerrar como «Resuelto» ni «Hablar con el cliente» si hay un bloqueo activo: la ventana lo avisa y solo ofrece «Mantener el bloqueo» o «Levantar el bloqueo», y el servidor lo exige (409). Así el bloqueo nunca queda escondido.
4. Sin migración.

## 1.2.4-beta.1 (2026-11-16)
«Insistir al compita» en una cita sin confirmar de verdad funciona (hallazgo 16 de la auditoría de flujos).
1. Bug: el botón no reenviaba la cita. La cita se le manda al compita por Telegram sin guardar un aviso, así que el botón buscaba «el último aviso sin atender de ese compita», que casi nunca era el de la cita. Si ese aviso ya no aplicaba (por ejemplo una solicitud ya respondida), no salía nada y aun así se contaba como «reenviado 1 de 3».
2. Ahora, en una tarea de cita sin confirmar, insistir le manda al compita LA CITA pendiente con sus botones «Confirmo la cita» y «No puedo a esa hora» (`recordarCitaAlCompita`). El tope sigue siendo uno cada 30 minutos y 3 por propuesta, contado con eventos `cita_insistida`.
3. Si la cita ya se resolvió (la visita se programó, terminó o la propuesta cambió), no se manda nada y la tarea se cierra, y la Bandeja ya no ofrece el botón. Sin Telegram vinculado o si Telegram falla, lo dice claro y no cuenta como reenvío.
4. Arreglo general: en cualquier «Insistir», un aviso que ya no aplica o que ya se envió deja de contarse como reenviado; se explica («No se reenvió nada: eso ya se resolvió») y, si ya no aplica, se cierra la tarea. La pantalla vuelve a leer la lista después de cada intento.
5. Sin migración.

## 1.2.3-beta.1 (2026-11-16)
Las tareas de la Bandeja se cierran solas cuando lo que las originó ya se resolvió, y se leen mejor (hallazgo 15 de la auditoría de flujos).
1. «Cita sin confirmar» seguía abierta aunque la cita ya se hubiera confirmado, hecho y cerrado. Ahora se cierra en el momento (el compita confirma o rechaza la hora, el cliente elige otra o reagenda) y, además, la escalera barre cada 5 minutos las que hayan quedado abiertas por cualquier otro camino (`lib/tareas-obsoletas.ts`): sin propuesta vigente, visita terminada o inexistente, o una propuesta ya reemplazada. Lo mismo para «cita sin Telegram» cuando el compita ya tiene Telegram. Cierra también las que ya estaban atascadas.
2. La nota de una tarea larga se podía cortar sin forma de leerla: ahora lleva «Ver más» y «Ver menos».
3. El botón apagado («Insistir al compita» dentro de su espera de 30 minutos o con 3 envíos ya hechos) ahora dice en una línea visible por qué y cuándo vuelve; la razón completa sigue en el ⓘ.
4. Los emojis de las tareas (📅, ⏳, ⚠️) se quitan en el panel, también de las ya guardadas (regla: emojis solo en Telegram). El texto «hace 0 horas» pasa a «hace menos de una hora».
5. Sin migración. Las tareas de seguridad y emergencia se siguen cerrando a mano a propósito.

## 1.2.2-beta.1 (2026-11-16)
Los correos del fin de la visita salen por el sistema de avisos (Nivel 1, parte C).
1. El resumen de la visita (al terminar) y el reporte de bienestar (cuando el compita termina el cuestionario) dejan de enviarse directo desde Telegram: ahora son los avisos `visita_resumen` y `visita_reporte`, que arman el correo al enviar con lo que hay en la base. Así el portal del cliente recibe la novedad en vivo («La visita terminó. Ya puedes calificarla.» y «El reporte de bienestar de la visita está listo.») y el correo es el respaldo: con `CORREO_RESPALDO=diferido` se cancela si el cliente ya lo vio y los dos se juntan en uno solo si llegan seguidos. Apagado, salen al instante como antes.
2. El resumen con IA del reporte se escribe y se guarda en `reportes_visita.resumen_ia` antes de avisar (antes se guardaba después de enviar el correo), así el portal y el correo muestran el mismo texto.
3. Lo que lee el compita en Telegram cambia: «Ya le dejamos el resumen básico a la familia en su portal» y «la familia ya puede ver el reporte en su portal».
4. `lib/resend.ts`: `armarVisitaResumen` y `armarResumenConReporte` arman el contenido sin enviar; `sendVisitaResumen` y `sendResumenConReporte` siguen existiendo para el envío directo. Sin migración nueva.

## 1.2.1-beta.1 (2026-11-16)
El correo al cliente como respaldo del portal (Nivel 1, parte B). Se enciende con `CORREO_RESPALDO=diferido` en Netlify; apagado, todo sale como antes.
1. Cada aviso por correo al cliente ya genera su novedad (el portal se actualiza en vivo). Con el interruptor encendido, el correo espera según la urgencia y si el portal está abierto: lo crítico sale ya; lo demás, 15 minutos con el portal abierto y 3 con el portal cerrado.
2. Si el cliente ve la novedad en el portal, el correo se cancela («ya lo vio en el portal»). Si varios correos del mismo cliente están listos (o por salir en los próximos 5 minutos), salen juntos en UN correo con la lista y un botón al portal («agrupado en un solo correo»).
3. Lo corre el cron de la escalera (cada 5 minutos), antes de los demás pasos (`procesarCorreosDiferidos`, `lib/correos-diferidos.ts`). Solo toca los avisos que nacieron con su novedad; los demás pendientes siguen igual. Un respaldo o reenvío (`respaldoDe`) sale al instante.
4. Manual del equipo: «Un cliente dice que su correo no llegó al instante». Reglas completas en `docs/ciclo-comunicaciones.md`. Sin migración nueva (usa la de 1.2.0).
5. Todavía NO pasan por esta regla los correos que no salen por `notificar()`, como los del fin de la visita (parte C) y algunos del flujo de pago y de Telegram.

## 1.2.0-beta.1 (2026-11-16)
Novedades del cliente y portal en vivo (Nivel 1, parte A: la base). El portal es el centro de mando; el correo pasa a ser respaldo (parte B).
1. Migración `20261116_novedades_cliente.sql` (solo agrega, **la aplica Juan en compaz-prod antes de desplegar**): tabla `novedades_cliente` (lo que le pasa al cliente, con `vista_en` y `actuada_en`) con permiso de lectura solo de las propias y tiempo real, y la columna `usuarios.portal_visto_en`.
2. `lib/novedades.ts` y `lib/novedades-politica.ts`: registrar una novedad (una sola vez por clave), marcar lo visto, el latido del portal y las reglas de cuándo hace falta el correo según la urgencia (crítico, accionable, informativo) y si el portal está abierto (15 minutos con el portal abierto, 3 con el portal cerrado; lo crítico, ya).
3. En el portal (y el dashboard viejo), solo para clientes: `NovedadesEnVivo` escucha las novedades del cliente en tiempo real (la pantalla se actualiza al instante), manda un latido cada 45 segundos con la pestaña a la vista y marca lo nuevo como visto cuando el cliente lo está mirando. Rutas nuevas `POST /api/portal/latido` y `POST /api/portal/novedades/vistas`. Si el tiempo real falla, el portal sigue actualizándose por consultas periódicas.
4. Todavía no se genera ninguna novedad ni cambia ningún correo: eso llega en la parte B.

## 1.1.18-beta.1 (2026-11-16)
Los correos le dicen al cliente que no hace falta hacer clic si ya tiene el portal abierto (hallazgo 14 de la auditoría de flujos).
1. Todo correo al cliente que trae un botón al portal ahora lleva debajo: «Si ya tienes tu portal abierto, no hace falta que hagas clic: se actualiza solo y lo verás ahí.» Así, cuando el cliente ya está viendo su portal y le llega «tu compita confirmó», sabe que no tiene que abrir otra pestaña.
2. Se agrega en un solo lugar, `sendEmail` (el único punto por el que sale todo correo), con `lib/correo-portal.ts`: busca el primer enlace al portal (/dashboard o /portal), pone la nota justo debajo, una sola vez, y deja igual los correos sin botón al portal (sala de videollamada, panel del equipo, enlaces externos). Los correos nuevos la reciben solos.
3. Complementa a «una sola pestaña del portal» (1.1.17). Sin migración.

## 1.1.17-beta.1 (2026-11-16)
Una sola pestaña del portal (hallazgo 13 de la auditoría de flujos).
1. Al abrir el portal desde el botón de un correo teniéndolo ya abierto, se creaba una segunda pestaña idéntica. Un navegador no permite que un enlace (ni una página) pase al frente otra pestaña, así que ahora: la pestaña que ya estaba abierta se actualiza sola (ve lo nuevo sin hacer nada) y la pestaña nueva se queda quieta con un aviso («Ya tienes Compaz abierto en otra pestaña»), intenta cerrarse sola (el navegador solo lo permite a veces) y ofrece «Usar esta pestaña» o «Cerrar esta pestaña».
2. Si el cliente elige usar la nueva, la vieja queda en pausa con el mismo aviso. Si dos pestañas se abren a la vez, solo una queda vigente.
3. Solo para clientes (no para el administrador ni la vista previa), en el portal y en el dashboard viejo. Se comunica entre pestañas del mismo navegador (BroadcastChannel); no manda nada al servidor. Sin migración.

## 1.1.16-beta.1 (2026-11-16)
Teléfonos con país y validación (hallazgo 12 de la auditoría de flujos).
1. Nuevo módulo `lib/telefono.ts` (compartido por el servidor y la pantalla): cada país define cuántos dígitos lleva su número y cómo empieza (Venezuela, EE. UU. y Caribe +1, Colombia, España, México, Panamá, Chile, Argentina, Perú, Ecuador, Brasil, Costa Rica, Portugal, Italia y Reino Unido; cualquier otro con su + y entre 8 y 15 dígitos). Quita el 0 de marcación local, acepta espacios, guiones y paréntesis, y rechaza lo que no existe (operadora inventada, dígitos de más o de menos, letras). Todo se guarda en formato internacional sin espacios (+584145550101).
2. El teléfono del contacto en el sitio (dirección de la visita) ahora tiene país y número por separado (Venezuela por defecto, en dos filas a 375 px), dice en el momento si el número calza con las reglas del país y cómo se guardará («Se guardará como +58 414 555 0101»). El servidor valida igual: ya no basta cualquier cadena de 7 dígitos.
3. Lo ya guardado no se toca; al editar la dirección se reconoce y se muestra bien. No se cambiaron todavía los otros teléfonos del sistema (ficha del cliente, registro del compita, solicitud de postulación): usan una validación más simple. Sin migración.

## 1.1.15-beta.1 (2026-11-16)
La dirección es requisito para agendar una visita (hallazgo 11 de la auditoría de flujos).
1. Antes se podía pedir y confirmar una cita sin haber puesto la dirección (después se perseguía con recordatorios y tareas). Ahora el servidor no deja al cliente pedir la hora (`PUT /api/visita/fecha` responde 409) hasta que registre la dirección y el contacto en el sitio, y el compita no puede confirmarla sin ellos (`confirmarCita` responde `sin_direccion` y Telegram le explica por qué).
2. En el portal, «¿Dónde será esta visita?» va ANTES de la fecha y el botón de confirmar la fecha queda apagado, con un aviso, hasta que se guarde la dirección; se enciende solo al guardarla. Lo mismo en el dashboard viejo.
3. Sin migración.

## 1.1.14-beta.1 (2026-11-16)
Punto rojo con número en el menú del panel (hallazgo 10 de la auditoría de flujos).
1. Junto a Bandeja aparece un punto rojo con el número de tareas NUEVAS que aún no has visto, como los mensajes sin leer: se quita al abrir la Bandeja con la pestaña a la vista y vuelve a aparecer cuando llega algo nuevo. Lo «visto» se guarda en cada navegador, por persona. Junto a Pagos, el número de pagos por confirmar: ese NO se quita al verlo, se va al confirmarlos (es dinero esperando).
2. Está en el menú de escritorio y en la barra del teléfono, solo para quien tiene el permiso de esa sección, con un texto que dice qué cuenta (al pasar el cursor y para lectores de pantalla). La ayuda ⓘ de la Bandeja y el manual lo explican.
3. El número también sale en el título de la pestaña del navegador, por ejemplo «(3) Panel». Se consulta cada 20 segundos con la pestaña a la vista y cada 60 con la pestaña oculta; una sola consulta sirve a todos los puntos. Al resolver una tarea o confirmar un pago se actualiza al instante.
4. Rutas nuevas `GET /api/admin/pendientes-bandeja?desde=` (permiso atender: devuelve `n`, `nuevas` y `ahora`) y `GET /api/admin/pendientes-pagos` (permiso pagos). Solo devuelven números. Sin migración.

## 1.1.13-beta.1 (2026-11-16)
El chat que el equipo revisa se actualiza solo (hallazgo 9 de la auditoría de flujos).
1. El chat entre cliente y compita en el panel se cargaba una sola vez al abrirlo: había que cerrarlo y abrirlo de nuevo para ver mensajes nuevos. Ahora se actualiza cada 10 segundos, solo con la pestaña a la vista, y pide únicamente los mensajes nuevos.
2. Actualizar NO anota un acceso nuevo (serían cientos de líneas en Actividad), pero tampoco se salta el motivo: el servidor solo responde si esa misma persona abrió ese mismo chat en los últimos 30 minutos. Pasado el plazo se detiene y aparece «Seguir viendo», que lo abre de nuevo (un colaborador da su motivo otra vez) y lo anota otra vez.
3. `POST /api/admin/chat` acepta `refrescar: true` y `desde`. Sin migración.

## 1.1.12-beta.1 (2026-11-16)
La Bandeja se actualiza sola y los pagos tienen su pestaña (hallazgo 8 de la auditoría de flujos).
1. La Bandeja no tenía actualización automática (solo Actividad y Estado la tenían): hacía falta recargar a mano. Ahora se actualiza cada 30 segundos, o cada 15 si hay un pago por confirmar, y solo con la pestaña a la vista (`AutoRefresh`: no gasta recursos con la pestaña oculta).
2. Pestaña nueva «Pagos» (permiso de pagos): arriba «Por confirmar» (con el tiempo que lleva esperando cada uno y el botón Confirmar pago) y debajo los pagos registrados y anulados. También se actualiza sola. La tarea de pago sigue en la Bandeja.
3. `POST /api/admin/confirmar-pago` acepta `solicitud_pago_id` además de `flag_id`; el monto y el cliente siempre salen del servidor. Sin migración.

## 1.1.11-beta.1 (2026-11-15)
Ver el perfil público de cada compita, tal como lo ve la familia (hallazgo 7 de la auditoría de flujos).
1. En la ficha del compita, el botón «Ver perfil público» abre `/panel/perfil-publico/[id]`: el mismo perfil que ve la familia (foto, sobre mí, servicios, zonas, disponibilidad, video y reseñas publicadas), con lo que el compita llenó. Funciona aunque aún no esté verificado y dice qué le falta para aparecer en el listado.
2. La pieza del perfil se sacó del listado de la familia a `components/ui/PerfilPublicoCompita.tsx`: ahora el equipo y la familia ven exactamente lo mismo.
3. Solo con el permiso de cuentas, solo lectura, sin teléfono ni correo. Sin migración.

## 1.1.10-beta.1 (2026-11-15)
«Todo de este compita» y «Todo de este cliente» en la ficha de Personas (hallazgo 6 de la auditoría de flujos).
1. Para revisar la calidad sin salir de la ficha. Compita: foto, enlace a su video, cómo lo ve la familia (descripción, servicios, horarios), calificaciones y reseñas (con si están publicadas), solicitudes y visitas. Cliente: ficha del familiar, plan, solicitudes, visitas y reseñas que escribió.
2. Solo con el permiso de cuentas y solo lectura. Nunca lleva teléfono ni correo. La condición y las notas de salud del familiar las ve solo un administrador.
3. Sin migración.

## 1.1.9-beta.1 (2026-11-15)
Responder una duda del compita desde el panel (hallazgo 5 de la auditoría de flujos).
1. La tarea «Duda sin resolver» ahora tiene el botón «Responder por Telegram»: el equipo escribe la respuesta en el panel (hasta 800 caracteres, sin teléfonos ni correos) y el bot se la envía al compita como mensaje del equipo. Antes la tarea decía «respóndele por Telegram» y no había cómo hacerlo desde el sistema.
2. Al enviar, la tarea se cierra y queda un evento con quién respondió y qué dijo. Si Telegram falla o el compita no lo tiene vinculado, la tarea sigue abierta y se explica por qué.
3. Ruta nueva `POST /api/admin/responder-duda` (permiso «atender»). Sin migración.

## 1.1.8-beta.1 (2026-11-15)
El portal muestra la hora elegida para la entrevista (hallazgo 4 de la auditoría de flujos).
1. Tras elegir hora, la tarjeta dice «Esperando que X confirme tu hora», la hora que eligió (en su hora y en la de Caracas) y que está pendiente de confirmar por el compita.
2. Solo cambia texto y lectura: no requiere migración.

## 1.1.7-beta.1 (2026-11-15)
Seguridad del lugar en la solicitud del cliente (hallazgo 3 de la auditoría de flujos).
1. Con lugar privado, el formulario exige además: si hay animales; y, si estará alguien más, si habrá menores de edad y si estarán toda la visita o solo una parte. Opcional: «hay alguien con quien el compita no debe quedarse a solas». Todo por opciones, sin nombres ni texto libre.
2. El compita lo ve en el aviso de Telegram antes de aceptar; la precaución sale como advertencia y le recuerda que puede no aceptar.
3. Migración `20261115b_solicitud_datos_lugar.sql` (solo agrega la columna `solicitudes.datos_lugar`; la aplica Juan en compaz-prod antes de desplegar). Las solicitudes anteriores no muestran nada.

## 1.1.6-beta.1 (2026-11-15)
Casillas de servicios futuros del compita (hallazgo 2 de la auditoría de flujos).
1. Voluntariado y cuidado de mascotas: sin iconos y solo con de qué trata el servicio (se quitó la lista de preguntas futuras).
2. Las casillas «Quiero ofrecer este servicio» ya funcionan: guardan el interés en `compitas.intereses_futuros` desde el registro, la corrección y el perfil. La ficha del panel lo muestra.
3. Migración `20261115_compita_intereses_futuros.sql` (solo agrega una columna con valor por defecto; la aplica Juan en compaz-prod antes de desplegar).

## 1.1.5-beta.1 (2026-11-15)
Texto del onboarding del compita en masculino (hallazgo 1 de la auditoría de flujos).
1. `/onboarding`: «Bienvenida a Compaz» pasa a «Bienvenido a Compaz» y «recibir visitas» a «recibir solicitudes». El compita siempre va en masculino.
2. Solo cambia texto: no requiere migración.

## 1.1.4-beta.1 (2026-11-13)
Permisos del registro de sincronizaciones del CMC (corrección tras el traslado a Virginia).
1. Migración `20261113b_cmc_sincronizaciones_permisos`: `service_role` vuelve a tener solo lectura y alta sobre `cmc_sincronizaciones` (lo aprobado en la `20261111`). Al copiar la base a `compaz-prod` había quedado con todos los privilegios. Solo cambia privilegios: no toca datos, columnas, restricciones ni RLS. Es idempotente y no depende del historial de migraciones.
2. Comprobación de solo lectura `tests/sql/cmc_sincronizaciones_permisos.sql` y prueba local completa `tests/sql/cmc_permisos_local.sh` (estado de `compaz-prod`, corrección aplicada dos veces, datos intactos y operaciones de la web).
3. Sin cambios de código: no requiere despliegue por sí sola.

## 1.1.3-beta.1 (2026-11-12)
Personas sin viajes al servidor.
1. Personas recibe la lista completa una vez; ordenar, filtrar por vista o estado, buscar (letra por letra) y cambiar de página se resuelve en el navegador (`PersonasInteractivo`, `lib/panel-personas-cliente.ts`). La dirección se mantiene al día con `history.replaceState` (con un retraso corto): refrescar o compartir el enlace restaura el mismo estado. Abrir una ficha o un chat sigue yendo al servidor.
2. Medido en producción tras la 1.1.2: el contenido completo de cada pantalla llega en 250 a 450 ms casi siempre (antes 700 a 1750 ms); quedan picos ocasionales de 600 a 860 ms por arranque en frío de la función.
3. Se documenta el cambio de producción a Virginia y la vuelta atrás.

## 1.1.2-beta.1 (2026-11-12)
El panel se siente inmediato.
1. El menú y el encabezado del panel salen al instante; los datos de cada pantalla llegan después, con un esqueleto gris mientras tanto (`app/panel/loading.tsx` y `ContenidoPanel` dentro de `Suspense`).
2. Los enlaces del panel ya no precargan: cada precarga ejecutaba la pantalla entera en el servidor (decenas de peticiones en segundo plano que gastaban créditos de Netlify y competían con lo que hacía la persona).
3. El proxy de /panel y /admin ya no consulta a Supabase Auth en cada pantalla (solo renueva la sesión); la página sigue verificando al usuario.
4. Más, Estado, Velocidad: botón para el administrador que mide la latencia entre el servidor y la base.

## 1.1.1-beta.1 (2026-11-12)
Preparación de la migración de Supabase a Virginia.
1. La dirección de Supabase en la política de seguridad del navegador (CSP) ya no está escrita a mano: sale de `NEXT_PUBLIC_SUPABASE_URL`. Cambiar de proyecto (o volver atrás) es solo cambiar la variable.
2. Scripts de migración (`scripts/migracion/`) y plan (`docs/migracion-supabase-virginia.md`).

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
