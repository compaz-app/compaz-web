// Ajustes: fuente única de precios, plazos, topes y textos que el administrador puede cambiar sin tocar el código.
// El CATÁLOGO de abajo tiene el valor por defecto de cada ajuste (precios desde lib/planes.ts). La tabla `ajustes`
// solo guarda lo que el administrador cambió. Si falta una fila, está inválida o la base falla, se usa el valor del
// catálogo: el sistema nunca se rompe por un ajuste. Cada cambio queda en `ajustes_historial` (solo inserción).
// Ver docs/construccion-real.md y docs/plan-construccion.md ("AJUSTES COMO FUENTE ÚNICA").

import { createAdminSupabase } from '@/lib/supabase-server'
import { PLANES, PRECIO_HORA_EXTRA_USD, PRECIO_MANDADO_USD } from '@/lib/planes'

export type TipoAjuste = 'numero' | 'texto'
export type ValorAjuste = number | string

export interface DefAjuste {
  clave: string
  /** Qué es este ajuste, para qué sirve y qué pasa al cambiarlo, en palabras llanas. Es lo primero que dice su ⓘ. Obligatorio: sin esto el ajuste no compila. */
  explica: string
  /** false = el sistema TODAVÍA NO lee este ajuste (el valor real está fijo en el código): la pantalla y la ruta de administración no dejan cambiarlo, para no prometer algo que no ocurre. Al conectarlo, se quita esta marca. */
  conectado?: false
  grupo: 'Precios' | 'Pagos' | 'Plazos de las citas' |'Cancelaciones de compitas' | 'Ayuda automática' | 'Llamadas' | 'Seguridad y datos' | 'Semáforo de Seguimiento'
  etiqueta: string
  tipo: TipoAjuste
  defecto: ValorAjuste
  unidad?: '$' | 'h' | 'min' | 'días' | '%'
  min?: number
  max?: number
  /** Dónde se usa: es lo que el administrador ve antes de guardar un cambio. */
  usa: string[]
  /** true cuando la cifra es una propuesta todavía sin confirmar por el dueño. */
  propuesto?: boolean
}

const TEXTO_ANTIFRAUDE_CLIENTE = 'Compaz nunca te pedirá por teléfono, mensaje o llamada tus datos personales, claves, códigos, depósitos ni transferencias. Los pagos se hacen solo con los datos que ves aquí, en tu portal. Si alguien te los pide por otro medio, no respondas y avísanos.'
const TEXTO_ANTIFRAUDE_COMPITA = 'Compaz nunca te pedirá por teléfono o mensaje dinero, depósitos, transferencias ni claves, y nunca te da el contacto del cliente. Si alguien te los pide en nombre de Compaz, no respondas y avísanos aquí.'

export const CATALOGO = [
  // ── Precios
  { clave: 'precio_hora', explica: 'Lo que cuesta una hora de servicio. Con este valor se calculan las visitas extra (se cobran por hora) y se comprueba que ningún plan salga más caro que comprar las horas sueltas. Al cambiarlo, los clientes ven el precio nuevo desde ese momento; lo ya pagado no cambia.', grupo: 'Precios', etiqueta: 'Hora de servicio', tipo: 'numero', defecto: PRECIO_HORA_EXTRA_USD, unidad: '$', min: 1, max: 500, usa: ['Página de pago', 'Agendar otra visita', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página', 'Precio tachado de los planes'] },
  { clave: 'precio_mandado', explica: 'Tarifa plana de un mandado (una diligencia de hasta 1 hora), dure 15 minutos o 1 hora. Es lo que se le cobra al cliente cuando pide un mandado. Lo ya pagado no cambia.', grupo: 'Precios', etiqueta: 'Mandado (tarifa plana, máximo 1 hora)', tipo: 'numero', defecto: PRECIO_MANDADO_USD, unidad: '$', min: 1, max: 500, usa: ['Formulario de mandado', 'Aviso al compita', 'Correos de pago', 'Asistente de la página'] },
  { clave: 'precio_plan_quincenal', explica: 'Precio mensual del plan Compañía: 2 visitas de 2 horas cada una. Es lo que paga el cliente al contratarlo. Debe costar menos que 4 horas sueltas; si no, el sistema te avisa y pide confirmación. Lo ya pagado no cambia.', grupo: 'Precios', etiqueta: 'Plan Compañía (2 visitas de 2 h)', tipo: 'numero', defecto: PLANES.quincenal.precioUsd, unidad: '$', min: 1, max: 5000, usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'] },
  { clave: 'precio_plan_semanal', explica: 'Precio mensual del plan Compañía Plus: 4 visitas de 2 horas cada una (8 horas). Debe costar menos que 8 horas sueltas; si no, el sistema te avisa y pide confirmación. Lo ya pagado no cambia.', grupo: 'Precios', etiqueta: 'Plan Compañía Plus (4 visitas de 2 h)', tipo: 'numero', defecto: PLANES.semanal.precioUsd, unidad: '$', min: 1, max: 5000, usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'] },
  // ── Plazos de las citas
  { clave: 'cancelacion_gratis_horas', explica: 'Cuántas horas antes de la visita puede el cliente cambiarla o cancelarla sin perderla. Con menos aviso, la visita cuenta como usada de su plan. Es la regla que el cliente acepta en los términos. Subirlo protege más al compita; bajarlo da más libertad al cliente.', grupo: 'Plazos de las citas', etiqueta: 'Cancelación gratuita, horas antes', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 168, usa: ['Portal del cliente (cambiar o cancelar)', 'Términos que acepta el cliente', 'Regla de "cuenta como usada"', 'Avisos al compita'] },
  { clave: 'nadie_abre_espera_min', explica: 'Cuando el compita llega y nadie abre, son los minutos que espera en la puerta antes de poder cerrar la visita como “sin acceso” (cuenta como usada). Es la cuenta atrás que ve el cliente. Subirlo da más margen a la familia; bajarlo libera antes al compita.', grupo: 'Plazos de las citas', etiqueta: 'Espera si nadie abre', tipo: 'numero', defecto: 30, unidad: 'min', min: 10, max: 120, usa: ['Cuenta atrás del cliente', 'Aviso al compita', 'Cierre automático', 'Términos que acepta el cliente'] },
  { clave: 'nadie_abre_contacto1_min', explica: 'Si nadie abre, a estos minutos el equipo recibe la primera tarea en la Bandeja: contactar a la persona de contacto en el sitio. Debe ser menor que el segundo contacto.', grupo: 'Plazos de las citas', etiqueta: 'Primer contacto si nadie abre', tipo: 'numero', defecto: 5, unidad: 'min', min: 1, max: 60, usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'] },
  { clave: 'nadie_abre_contacto2_min', explica: 'Si siguen sin abrir, a estos minutos llega la segunda tarea: intentar con el cliente directamente. Debe ir después del primer contacto y antes de que termine la espera.', grupo: 'Plazos de las citas', etiqueta: 'Segundo contacto si nadie abre', tipo: 'numero', defecto: 15, unidad: 'min', min: 2, max: 90, usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'] },
  { clave: 'reporte_llamada_horas', explica: 'Cuando un compita reporta un problema serio con un cliente y pide que lo llamen, es el plazo en horas que se le promete para esa llamada. Si pasa sin que registres la llamada, llega una tarea y una alerta urgente.', grupo: 'Plazos de las citas', etiqueta: 'Plazo para llamar al compita que reportó un problema con un cliente', tipo: 'numero', defecto: 24, unidad: 'h', min: 24, max: 72, usa: ['Mensaje al compita con el plazo', 'Tarea y alerta si se pasa el plazo'] },
  { clave: 'todo_bien_min', explica: 'Pasados estos minutos de la hora de fin de una visita que sigue en curso, el bot le pregunta al compita “¿Todo bien?”. Sirve para detectar visitas alargadas o algún problema. Se pregunta una sola vez por visita.', grupo: 'Plazos de las citas', etiqueta: '"¿Todo bien?" después de la hora de fin', tipo: 'numero', defecto: 15, unidad: 'min', min: 5, max: 120, usa: ['Aviso al compita', 'Alerta al equipo si no responde'] },
  { clave: 'cambio_lugar_pct', explica: 'Si el cliente cambia quién estará en el lugar y el compita no responde, se espera este porcentaje del tiempo que falta para la visita antes de abrir una tarea en la Bandeja, con el tope del ajuste siguiente. Ejemplo: faltan 20 horas y el 25 % son 5 horas.', grupo: 'Plazos de las citas', etiqueta: 'Cambio en el lugar sin respuesta del compita: avisar al admin tras este % del tiempo que falta para la visita', tipo: 'numero', defecto: 25, unidad: '%', min: 5, max: 100, usa: ['Tarea "Cambio en el lugar" en la Bandeja'] },
  { clave: 'cambio_lugar_max_horas', explica: 'Tope de espera por la respuesta del compita ante un cambio en el lugar: aunque el porcentaje dé más horas, no se espera más que esto antes de abrir la tarea. Si la visita es muy pronto, la tarea se abre de inmediato.', grupo: 'Plazos de las citas', etiqueta: 'Cambio en el lugar: espera máxima antes de avisar al admin', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 48, usa: ['Tarea "Cambio en el lugar" en la Bandeja'] },
  { clave: 'todo_bien_respuesta_min', explica: 'Después de preguntarle “¿Todo bien?” al compita, son los minutos que se espera su respuesta. Si no responde, llega una alerta urgente al equipo (una sola vez). Sirve para actuar rápido si algo pasó en la visita.', grupo: 'Plazos de las citas', etiqueta: 'Minutos para responder al "¿Todo bien?" antes de alertar al equipo', tipo: 'numero', defecto: 10, unidad: 'min', min: 3, max: 60, usa: ['Alerta urgente al equipo si el compita no responde'] },
  { clave: 'direccion_horas_antes', explica: 'Cuántas horas antes de la visita se le manda al compita la dirección exacta por Telegram. Si el cliente aún no la ha registrado en ese momento, se abre una tarea urgente y se le avisa por correo. La dirección no se da antes para proteger a la familia.', grupo: 'Plazos de las citas', etiqueta: 'Dirección exacta al compita, horas antes', tipo: 'numero', defecto: 3, unidad: 'h', min: 1, max: 24, usa: ['Aviso al compita en Telegram'] },
  { clave: 'reserva_horario_horas', explica: 'Cuando un cliente elige una hora de entrevista, esa hora queda apartada por estas horas esperando que el compita la confirme; si no, se libera para otros. Nunca dura más que el tiempo que falta para la entrevista.', grupo: 'Plazos de las citas', etiqueta: 'Reserva de un horario sin confirmar, horas (nunca pasa de la hora de la cita)', tipo: 'numero', defecto: 2, unidad: 'h', min: 1, max: 48, usa: ['Reserva de la entrevista', 'Recordatorio al compita'] },
  { clave: 'entrevista_anticipacion_horas', explica: 'Con cuánta anticipación mínima puede el cliente pedir una entrevista: no ve horas más cercanas a este valor. 0 significa que puede pedir una hora para dentro de poco. Súbelo si los compitas necesitan más tiempo para prepararse.', grupo: 'Plazos de las citas', etiqueta: 'Anticipación mínima para pedir una entrevista (0 = sin mínimo)', tipo: 'numero', defecto: 0, unidad: 'h', min: 0, max: 72, usa: ['Horas libres que ve el cliente'] },
  // ── Pagos
  { clave: 'pago_insistencia_min', explica: 'Si un cliente toca “ya pagué” varias veces, el equipo recibe una alerta urgente con el botón de confirmar, pero no más de una por este tiempo. Evita llenarte de avisos por el mismo pago.', grupo: 'Pagos', etiqueta: 'Entre alertas URGENTES cuando el cliente insiste en que ya pagó', tipo: 'numero', defecto: 30, unidad: 'min', min: 5, max: 240, usa: ['Aviso URGENTE de pago al equipo en Telegram'] },
  { clave: 'pago_escalada_horas', explica: 'Si un pago que el cliente dice haber hecho lleva estas horas sin confirmarse, se avisa a todos los administradores por correo y Telegram, porque el cliente está esperando para avanzar. Bájalo si quieres que se escale más pronto.', grupo: 'Pagos', etiqueta: 'Horas sin confirmar un pago insistido antes de avisar a todos los administradores por correo', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 72, usa: ['Correo a los administradores', 'Aviso en Telegram'] },
  // ── Cancelaciones de compitas
  { clave: 'compita_aviso_minimo_horas', explica: 'Cuántas horas antes de la visita debe cancelar un compita para que cuente como a tiempo. Con menos aviso es una cancelación tardía: se cuenta en su contra salvo que el equipo la justifique. Se lo dice el sistema al cancelar y se ve en Personas.', grupo: 'Cancelaciones de compitas', etiqueta: 'Aviso mínimo para que una cancelación sea a tiempo', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 168, usa: ['Columna y filtro de Personas', 'Ficha del compita', 'Aviso al compita al cancelar'] },
  { clave: 'canc_revision', explica: 'Cuántas cancelaciones tardías sin justificar puede acumular un compita, dentro de la ventana, antes de que se abra una tarea de revisión en la Bandeja. Con 2, a la segunda conviene hablar con esa persona. En su semáforo pasa a amarillo. Debe ser menor que el número de pausa.', grupo: 'Cancelaciones de compitas', etiqueta: 'Cancelaciones tardías para abrir una revisión', tipo: 'numero', defecto: 2, min: 1, max: 10, usa: ['Bandeja (tarea "Cancelación tardía")', 'Semáforo del compita (amarillo)'] },
  { clave: 'canc_pausa', explica: 'Con tantas cancelaciones tardías sin justificar dentro de la ventana, las solicitudes nuevas del compita se pausan solas hasta que el equipo hable con él y lo resuelva. Se ve en rojo en Personas. Debe ser mayor que el número de revisión.', grupo: 'Cancelaciones de compitas', etiqueta: 'Cancelaciones tardías para pausar sus solicitudes nuevas', tipo: 'numero', defecto: 3, min: 2, max: 20, usa: ['Solicitudes nuevas del compita', 'Semáforo del compita (rojo)', 'Bandeja'] },
  { clave: 'canc_ventana_dias', explica: 'Cuántos días hacia atrás se cuentan las cancelaciones tardías de un compita. Con 30, una cancelación de hace más de un mes ya no suma. Subirlo es más estricto; bajarlo perdona antes.', grupo: 'Cancelaciones de compitas', etiqueta: 'Ventana para contar las cancelaciones', tipo: 'numero', defecto: 30, unidad: 'días', min: 7, max: 365, usa: ['Columna y filtro de Personas', 'Ficha del compita'] },
  // ── Ayuda automática
  { clave: 'ayuda_intentos', explica: 'En el botón “Tengo una duda”, el bot intenta resolver solo. Es el número de veces que lo intenta con la misma duda antes de pasársela a una persona: se abre una tarea en la Bandeja para que le respondas por Telegram.', grupo: 'Ayuda automática', etiqueta: 'Intentos del bot antes de pasar la duda a una persona', tipo: 'numero', defecto: 2, min: 1, max: 5, usa: ['Menú "Tengo una duda" del compita', 'Tarea "Duda sin resolver" en la Bandeja', 'Ayuda del cliente'] },
  { clave: 'timbre_max_hora', explica: 'Máximo de alertas urgentes que te suenan por Telegram en una hora. Pasado ese número, el resto se resume en un solo mensaje que te manda a la Bandeja, para no inundarte. Lo crítico (seguridad de personas) nunca se silencia.', grupo: 'Ayuda automática', etiqueta: 'Máximo de urgencias por hora que suenan por Telegram (el resto se resume en un solo mensaje)', tipo: 'numero', defecto: 8, min: 1, max: 60, usa: ['Telegram del administrador', 'Bandeja del panel'] },
  { clave: 'recordatorio_cliente_horas', explica: 'El compita puede recordarle al cliente un paso pendiente (elegir hora, pagar, registrar la dirección). Es el tiempo mínimo entre un recordatorio y el siguiente, para no llenarle el correo.', grupo: 'Ayuda automática', etiqueta: 'Horas mínimas entre un recordatorio y otro que el compita le manda al cliente', tipo: 'numero', defecto: 12, unidad: 'h', min: 1, max: 72, usa: ['Botón "Recordarle al cliente" del compita'] },
  { clave: 'recordatorio_cliente_max', explica: 'Cuántos recordatorios puede mandar el compita por el mismo pendiente. Al llegar al máximo, el equipo recibe una tarea (“Sin respuesta a recordatorios”) para contactar al cliente, porque más correos no ayudan.', grupo: 'Ayuda automática', etiqueta: 'Máximo de recordatorios al cliente por el mismo pendiente', tipo: 'numero', defecto: 3, min: 1, max: 10, usa: ['Botón "Recordarle al cliente" del compita'] },
  // ── Llamadas (sin límite de cantidad: solo de duración)
  { clave: 'llamada_aviso_min', explica: 'En la videollamada de presentación (la entrevista), a estos minutos desde la hora de la llamada aparece dentro de la sala una franja con la cuenta atrás hasta el cierre automático. Debe ser antes del corte.', grupo: 'Llamadas', etiqueta: 'Aviso de fin de una llamada fuera de visita', tipo: 'numero', defecto: 20, unidad: 'min', min: 5, max: 60, usa: ['Videollamada de presentación', 'Aviso de fin dentro de la sala'] },
  { clave: 'llamada_corte_min', explica: 'Minutos tras los cuales la llamada se corta sola. Controla el costo de la videollamada y evita salas abiertas. Debe ser posterior al aviso de fin.', grupo: 'Llamadas', etiqueta: 'Corte automático de la llamada', tipo: 'numero', defecto: 23, unidad: 'min', min: 6, max: 70, usa: ['Salas de videollamada', 'Costo de la videollamada'] },
  { clave: 'llamada_visita_min', explica: 'Duración de cada llamada entre compita y cliente durante una visita (botón “Llamar al cliente” y las llamadas del cliente desde su portal). La sala se cierra sola al cumplirse y, cuando falta la mitad de un minuto o un minuto (lo que sea menos), aparece dentro de la sala una franja con la cuenta atrás. Para seguir hablando se inicia otra llamada.', grupo: 'Llamadas', etiqueta: 'Llamada durante una visita', tipo: 'numero', defecto: 5, unidad: 'min', min: 1, max: 20, usa: ['Botón "Llamar al cliente"', 'Aviso en la sala'] },
  // ── Seguridad y datos
  { clave: 'antifraude_cliente', explica: 'La advertencia que ve el cliente de que Compaz nunca le pide datos ni dinero por teléfono o mensaje. Aparece en la pantalla de acceso, el pago, la ficha, el chat y los correos. No se puede quitar, solo cambiar el texto.', grupo: 'Seguridad y datos', etiqueta: 'Texto de la advertencia antifraude para clientes (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: TEXTO_ANTIFRAUDE_CLIENTE, max: 600, usa: ['Pantalla de acceso', 'Tarjeta de pago', 'Ficha', 'Chat de la visita', 'Pie del portal', 'Correos'] },
  { clave: 'antifraude_compita', explica: 'La advertencia que recibe el compita de que Compaz nunca le pide dinero ni claves y nunca le da el contacto del cliente. Aparece en su Telegram y en el correo de bienvenida. No se puede quitar, solo cambiar el texto.', grupo: 'Seguridad y datos', etiqueta: 'Texto de la advertencia antifraude para compitas (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: TEXTO_ANTIFRAUDE_COMPITA, max: 600, usa: ['Telegram del compita', 'Correo de bienvenida del compita'] },
  { clave: 'recordatorio_chat_contactos', explica: 'El mensaje que el sistema escribe dentro del chat entre cliente y compita cuando detecta que alguien intentó compartir un teléfono, un correo u otro contacto directo (el dato se borra y se avisa al equipo). Es la regla que más protege a ambos. Se puede cambiar el texto, no quitarlo. Se admite *negrita* con asteriscos.', grupo: 'Seguridad y datos', etiqueta: 'Mensaje en el chat cuando se detecta un contacto (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: '🚫 *Dato de contacto detectado y reportado al equipo Compaz.* Toda comunicación debe ocurrir en esta plataforma. Acordar servicios por fuera viola los términos y puede suspender tu cuenta sin reembolso.', max: 400, usa: ['Chat de coordinación y de la visita (cliente y compita)'] },
  { clave: 'detecciones_umbral', explica: 'Cuando alguien intenta compartir un teléfono o un correo por el chat, el dato se borra y se anota una detección. Con este número de detecciones dentro de la ventana, su cuenta pasa a pausa y el equipo decide: reactivar, dar otra oportunidad o bloquear.', grupo: 'Seguridad y datos', etiqueta: 'Detecciones de contacto antes de alertar al equipo', tipo: 'numero', defecto: 2, min: 1, max: 10, usa: ['Aviso al escribir', 'Alerta en la Bandeja', 'Ficha de la persona'] },
  { clave: 'detecciones_ventana_dias', explica: 'Cuántos días hacia atrás se cuentan las detecciones de contacto de una persona. Con 30, una detección de hace más de un mes ya no suma para la pausa.', grupo: 'Seguridad y datos', etiqueta: 'Ventana para contar las detecciones', tipo: 'numero', defecto: 30, unidad: 'días', min: 1, max: 365, usa: ['Conteo por persona'] },
  { clave: 'cita_recordatorio_horas', explica: 'Cuando un cliente propone una hora de visita y el compita no responde, pasadas estas horas se le manda un recordatorio por Telegram para que la confirme o la rechace.', grupo: 'Plazos de las citas', etiqueta: 'Recordar al compita que confirme la cita de la visita tras estas horas sin respuesta', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 48, usa: ['Recordatorio por Telegram al compita'] },
  { clave: 'cita_escalada_horas', explica: 'Si el compita sigue sin confirmar la hora propuesta tras estas horas, se abre una tarea en la Bandeja y se le escribe al cliente por correo para que elija otra opción.', grupo: 'Plazos de las citas', etiqueta: 'Avisar al equipo y al cliente si el compita no confirma la cita tras estas horas', tipo: 'numero', defecto: 24, unidad: 'h', min: 2, max: 96, usa: ['Tarea en la Bandeja', 'Correo al cliente'] },
  { clave: 'portal_nuevo', explica: 'Interruptor general del portal nuevo del cliente. 1 = todos los clientes ven el portal nuevo; 0 = solo lo ven los clientes que activaste uno por uno y el equipo en vista previa. Se enciende cuando hayas revisado el portal nuevo.', grupo: 'Seguridad y datos', etiqueta: 'Portal nuevo del cliente (1 = lo ven todos los clientes, 0 = solo el equipo en vista previa; así se reemplaza el viejo por etapas)', tipo: 'numero', defecto: 0, min: 0, max: 1, usa: ['Ruta /portal del cliente', 'Portal actual (/dashboard)'] },
  { clave: 'llegada_foto_obligatoria', explica: '1 = el compita debe mandar una foto de llegada antes de poder iniciar la visita (queda guardada en privado y el cliente recibe el aviso de que llegó). 0 = puede iniciar sin foto. Es la prueba de que llegó al lugar.', grupo: 'Seguridad y datos', etiqueta: 'Foto de llegada obligatoria antes de iniciar la visita (1 = sí, 0 = no)', tipo: 'numero', defecto: 1, min: 0, max: 1, usa: ['Bot del compita (botón Iniciar visita)', 'Aviso de llegada al cliente'] },
  { clave: 'foto_retencion_dias', explica: 'Cuántos días se guardan las fotos privadas (de llegada, del cliente y del familiar) antes de borrarse de verdad en la limpieza diaria. Lo dicen los términos y la privacidad: si lo cambias, esos textos cambian.', grupo: 'Seguridad y datos', etiqueta: 'Borrado de fotos privadas (llegada, cliente, familiar)', tipo: 'numero', defecto: 90, unidad: 'días', min: 7, max: 730, usa: ['Limpieza diaria', 'Aviso al cliente y al compita', 'Términos y /privacidad'] },
  { clave: 'avisos_retencion_dias', explica: 'Cuántos días se guarda el registro de avisos enviados y la actividad del equipo antes de borrarse en la limpieza diaria. No incluye los accesos a datos sensibles, que tienen su propio plazo.', grupo: 'Seguridad y datos', etiqueta: 'Retención del registro de avisos y de la actividad del equipo', tipo: 'numero', defecto: 90, unidad: 'días', min: 30, max: 730, usa: ['Limpieza diaria', 'Actividad', 'Avisos enviados', 'Manual del equipo'] },
  { clave: 'accesos_retencion_dias', explica: 'Cuántos días se guarda el registro de quién del equipo vio un teléfono, un correo o un chat, y por qué. Es la garantía de privacidad de las familias, por eso se guarda más que el resto. Debe coincidir con lo que diga la política de privacidad.', grupo: 'Seguridad y datos', etiqueta: 'Retención del registro de accesos a datos sensibles (quién vio un teléfono, un correo o un chat, y por qué)', tipo: 'numero', defecto: 365, unidad: 'días', min: 90, max: 1825, usa: ['Limpieza diaria', 'Registro de accesos', 'Manual del equipo', 'Política de privacidad'] },
  // ── Semáforo de Seguimiento: horas SIN movimiento en una etapa antes de pasar a amarillo y a rojo (valores del prototipo aprobado; "Activo" usa 7 y 14 días).
  { clave: 'semaforo_solicitud_amarillo', explica: 'Horas sin movimiento en la etapa Solicitud (el cliente pidió una entrevista y espera la respuesta del compita) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Solicitud: pasa a amarillo desde', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_solicitud_rojo', explica: 'Horas sin movimiento en la etapa Solicitud (el cliente pidió una entrevista y espera la respuesta del compita) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Solicitud: pasa a rojo desde', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_entrevista_amarillo', explica: 'Horas sin movimiento en la etapa Entrevista (la entrevista está por elegir hora o ya confirmada) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Entrevista: pasa a amarillo desde', tipo: 'numero', defecto: 1, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_entrevista_rojo', explica: 'Horas sin movimiento en la etapa Entrevista (la entrevista está por elegir hora o ya confirmada) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Entrevista: pasa a rojo desde', tipo: 'numero', defecto: 3, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_decision_amarillo', explica: 'Horas sin movimiento en la etapa Decisión (terminó la entrevista y el cliente debe decidir si contrata) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Decisión: pasa a amarillo desde', tipo: 'numero', defecto: 2, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_decision_rojo', explica: 'Horas sin movimiento en la etapa Decisión (terminó la entrevista y el cliente debe decidir si contrata) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Decisión: pasa a rojo desde', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_pago_amarillo', explica: 'Horas sin movimiento en la etapa Pago (decidió contratar y falta pagar o que confirmemos el pago) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Pago: pasa a amarillo desde', tipo: 'numero', defecto: 2, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_pago_rojo', explica: 'Horas sin movimiento en la etapa Pago (decidió contratar y falta pagar o que confirmemos el pago) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Pago: pasa a rojo desde', tipo: 'numero', defecto: 12, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_ficha_amarillo', explica: 'Horas sin movimiento en la etapa Ficha (ya pagó y falta completar la ficha de su familiar) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Ficha: pasa a amarillo desde', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_ficha_rojo', explica: 'Horas sin movimiento en la etapa Ficha (ya pagó y falta completar la ficha de su familiar) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Ficha: pasa a rojo desde', tipo: 'numero', defecto: 48, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_activo_amarillo', explica: 'Horas sin movimiento en la etapa Activo (ya tiene plan y compita; cuenta el tiempo sin ningún movimiento (visita, solicitud o cancelación)) a partir de las cuales el punto pasa a amarillo, “esperando más de lo normal”, en Seguimiento. Debe ser menor que el rojo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Activo: pasa a amarillo desde', tipo: 'numero', defecto: 168, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
  { clave: 'semaforo_activo_rojo', explica: 'Horas sin movimiento en la etapa Activo (ya tiene plan y compita; cuenta el tiempo sin ningún movimiento (visita, solicitud o cancelación)) a partir de las cuales el punto pasa a rojo, “atascado”, en Seguimiento y en el caso del cliente. Debe ser mayor que el amarillo.', grupo: 'Semáforo de Seguimiento', etiqueta: 'Activo: pasa a rojo desde', tipo: 'numero', defecto: 336, unidad: 'h', min: 1, max: 2000, usa: ['Seguimiento', 'Caso de un cliente'] },
] as const satisfies readonly DefAjuste[]

export type ClaveAjuste = (typeof CATALOGO)[number]['clave']
export type Ajustes = Record<ClaveAjuste, ValorAjuste>

const POR_CLAVE = new Map<string, DefAjuste>(CATALOGO.map((d) => [d.clave, d]))

export function defAjuste(clave: string): DefAjuste | undefined {
  return POR_CLAVE.get(clave)
}

/** Valores por defecto de todo el catálogo (lo que rige si la base está vacía o no responde). */
export function ajustesPorDefecto(): Ajustes {
  return Object.fromEntries(CATALOGO.map((d) => [d.clave, d.defecto])) as Ajustes
}

// ── Validación ─────────────────────────────────────────────────────────────────────────────────────

export type ResultadoValidacion = { ok: true; valor: ValorAjuste } | { ok: false; error: string }

/** Valida un valor contra la definición de su ajuste (tipo, mínimo y máximo). */
export function validarValor(clave: string, crudo: unknown): ResultadoValidacion {
  const d = POR_CLAVE.get(clave)
  if (!d) return { ok: false, error: 'Ajuste desconocido' }
  if (d.tipo === 'texto') {
    if (typeof crudo !== 'string') return { ok: false, error: 'Debe ser un texto' }
    const t = crudo.trim()
    if (!t) return { ok: false, error: 'No puede quedar vacío' }
    if (d.max !== undefined && t.length > d.max) return { ok: false, error: `Máximo ${d.max} caracteres` }
    return { ok: true, valor: t }
  }
  const n = typeof crudo === 'string' && crudo.trim() !== '' ? Number(crudo) : crudo
  if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, error: 'Debe ser un número' }
  if (d.min !== undefined && n < d.min) return { ok: false, error: `Debe estar entre ${d.min} y ${d.max}` }
  if (d.max !== undefined && n > d.max) return { ok: false, error: `Debe estar entre ${d.min} y ${d.max}` }
  return { ok: true, valor: n }
}

/** Reglas que relacionan varios ajustes entre sí. Devuelve el mensaje del primer conflicto, o null. */
export function conflictoEntreAjustes(v: Ajustes): string | null {
  const n = (k: ClaveAjuste) => Number(v[k])
  if (n('llamada_corte_min') <= n('llamada_aviso_min')) return 'El corte de la llamada debe ser posterior al aviso de fin'
  if (n('canc_pausa') <= n('canc_revision')) return 'Las cancelaciones para pausar deben ser más que las de la revisión'
  if (n('nadie_abre_contacto1_min') >= n('nadie_abre_contacto2_min')) return 'El primer contacto debe ser antes que el segundo'
  if (n('nadie_abre_contacto2_min') >= n('nadie_abre_espera_min')) return 'El segundo contacto debe ser antes de que termine la espera'
  for (const e of ['solicitud', 'entrevista', 'decision', 'pago', 'ficha', 'activo'] as const) {
    if (n(`semaforo_${e}_rojo` as ClaveAjuste) <= n(`semaforo_${e}_amarillo` as ClaveAjuste)) return `En el semáforo, el rojo de ${e} debe llegar después del amarillo`
  }
  return null
}

/** Un plan que sale más caro que comprar las mismas horas sueltas no tiene sentido comercial. */
export function planesIncoherentes(v: Ajustes): { quincenal: number; semanal: number } | null {
  const hora = Number(v.precio_hora)
  const q = hora * 4 - Number(v.precio_plan_quincenal)
  const s = hora * 8 - Number(v.precio_plan_semanal)
  return q < 0 || s < 0 ? { quincenal: q, semanal: s } : null
}

// ── Lectura con caché corta y respaldo ─────────────────────────────────────────────────────────────

const TTL_MS = 30_000
let cache: { en: number; valores: Ajustes } | null = null

/** Solo para pruebas y para después de guardar un cambio. */
export function limpiarCacheAjustes() { cache = null }

/** Todos los ajustes vigentes: lo guardado, válido y ya vigente, y el valor por defecto para el resto. */
export async function getAjustes(): Promise<Ajustes> {
  if (cache && Date.now() - cache.en < TTL_MS) return cache.valores
  const valores = ajustesPorDefecto()
  try {
    const { data, error } = await createAdminSupabase().from('ajustes').select('clave, valor, vigente_desde')
    if (error) throw new Error(error.message)
    const ahora = Date.now()
    for (const fila of (data ?? []) as { clave: string; valor: unknown; vigente_desde: string | null }[]) {
      if (fila.vigente_desde && new Date(fila.vigente_desde).getTime() > ahora) continue
      const r = validarValor(fila.clave, fila.valor)
      if (r.ok) (valores as Record<string, ValorAjuste>)[fila.clave] = r.valor
      else console.error('[ajustes] valor guardado inválido, se usa el predeterminado:', fila.clave, r.error)
    }
  } catch (e) {
    console.error('[ajustes] no se pudo leer la base, se usan los valores predeterminados:', e)
    return valores // no se guarda en caché: se reintenta en la próxima lectura
  }
  cache = { en: Date.now(), valores }
  return valores
}

export async function getAjuste<K extends ClaveAjuste>(clave: K): Promise<Ajustes[K]> {
  return (await getAjustes())[clave]
}

// ── Escritura (solo desde rutas de administrador) ──────────────────────────────────────────────────

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; error: string; codigo: 'invalido' | 'conflicto' | 'incoherente' | 'base' }

/**
 * Guarda un cambio de ajuste: valida, revisa coherencia con los demás, escribe el valor nuevo y deja el
 * historial. Un plan más caro que las horas sueltas se rechaza salvo que el administrador lo confirme.
 */
export async function setAjuste(p: { clave: string; valor: unknown; actor: string; confirmarIncoherente?: boolean }): Promise<ResultadoGuardado> {
  const r = validarValor(p.clave, p.valor)
  if (!r.ok) return { ok: false, error: r.error, codigo: 'invalido' }
  const clave = p.clave as ClaveAjuste

  const actuales = await getAjustes()
  const propuestos: Ajustes = { ...actuales, [clave]: r.valor }
  const conflicto = conflictoEntreAjustes(propuestos)
  if (conflicto) return { ok: false, error: conflicto, codigo: 'conflicto' }
  if (!p.confirmarIncoherente && planesIncoherentes(propuestos) && !planesIncoherentes(actuales)) {
    return { ok: false, error: 'Con estos precios un plan sale más caro que comprar las mismas horas sueltas. Confirma si es lo que quieres.', codigo: 'incoherente' }
  }
  if (actuales[clave] === r.valor) return { ok: true } // sin cambio: no se ensucia el historial

  // Valor y historial se guardan juntos, en una sola operación de la base (función guardar_ajuste).
  const { error } = await createAdminSupabase().rpc('guardar_ajuste', {
    p_clave: clave, p_valor: r.valor, p_anterior: actuales[clave], p_actor: p.actor,
  })
  if (error) { console.error('[ajustes] guardar:', error.message); return { ok: false, error: 'No se pudo guardar el cambio', codigo: 'base' } }
  limpiarCacheAjustes()
  return { ok: true }
}

export type ResultadoGuardadoVarios = { ok: true; cambiados: string[] } | { ok: false; error: string; codigo: 'invalido' | 'conflicto' | 'incoherente' | 'base'; clave?: string }

/**
 * Guarda VARIOS cambios a la vez (el botón "Guardar y aplicar" de la pantalla). Se valida el conjunto completo antes de escribir nada: cada valor,
 * las reglas entre ajustes y los precios. Si algo no cuadra, no se guarda NADA. Cada cambio deja su fila en el historial.
 */
export async function setAjustes(p: { cambios: Record<string, unknown>; actor: string; confirmarIncoherente?: boolean }): Promise<ResultadoGuardadoVarios> {
  const claves = Object.keys(p.cambios)
  if (claves.length === 0) return { ok: true, cambiados: [] }
  const actuales = await getAjustes()
  const propuestos: Ajustes = { ...actuales }
  for (const c of claves) {
    const r = validarValor(c, p.cambios[c])
    if (!r.ok) return { ok: false, error: `${defAjuste(c)?.etiqueta ?? c}: ${r.error}`, codigo: 'invalido', clave: c }
    ;(propuestos as Record<string, ValorAjuste>)[c] = r.valor
  }
  const conflicto = conflictoEntreAjustes(propuestos)
  if (conflicto) return { ok: false, error: conflicto, codigo: 'conflicto' }
  if (!p.confirmarIncoherente && planesIncoherentes(propuestos) && !planesIncoherentes(actuales)) {
    return { ok: false, error: 'Con estos precios un plan sale más caro que comprar las mismas horas sueltas. Confirma si es lo que quieres.', codigo: 'incoherente' }
  }
  const cambiados: string[] = []
  for (const c of claves) {
    if (actuales[c as ClaveAjuste] === (propuestos as Record<string, ValorAjuste>)[c]) continue
    const { error } = await createAdminSupabase().rpc('guardar_ajuste', { p_clave: c, p_valor: (propuestos as Record<string, ValorAjuste>)[c], p_anterior: actuales[c as ClaveAjuste], p_actor: p.actor })
    if (error) { console.error('[ajustes] guardar varios:', error.message); limpiarCacheAjustes(); return { ok: false, error: `No se pudo guardar "${defAjuste(c)?.etiqueta ?? c}". Lo anterior ya guardado se conserva; revisa y vuelve a intentar.`, codigo: 'base', clave: c } }
    cambiados.push(c)
  }
  limpiarCacheAjustes()
  return { ok: true, cambiados }
}
