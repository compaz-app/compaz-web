'use client'
import { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useEmbedded, useUrlState } from '../useUrlState'
import InfoBoton from '../InfoBoton'
import { useRouter, useSearchParams } from 'next/navigation'
import { CATALOGO, type ClaveEspera } from '@/lib/esperas'
import { ENTRADAS, SECCIONES as SECCIONES_MANUAL, buscarEnManual, puedeLaEntrada, permisosDelManual, limitesDelManual, type EntradaManual } from '@/lib/manual'
import { PERMISOS as PERMISOS_MANUAL, ETIQUETA_PERMISO as ETIQUETA_PERMISO_MANUAL } from '@/lib/permisos-catalogo'

type Etapa = 'Solicitud' | 'Entrevista' | 'Decisión' | 'Pago' | 'Ficha' | 'Activo'
const ETAPAS: Etapa[] = ['Solicitud', 'Entrevista', 'Decisión', 'Pago', 'Ficha', 'Activo']

type EstadoCompita = 'Disponible' | 'Con cupo' | 'En pausa' | 'Nuevo'
type StatsCompita = { estado: EstadoCompita; activos: number; visitas: number; rating: number; respuesta: number; inactivoH: number; canc: number; tardias: number }

type Persona = { id: string; nombre: string; tipo: 'Cliente' | 'Compita'; zona: string; etapa?: Etapa; horas?: number; compita?: string; stats?: StatsCompita; nota: string; linea: { cuando: string; texto: string }[] }

const BASE: Persona[] = [
  { id: 'p1', horas: 3, nombre: 'Carolina Pérez', tipo: 'Cliente', zona: 'Miami → Chacao', etapa: 'Pago', compita: 'María', nota: 'Prefiere que le escriban por correo.', linea: [{ cuando: 'Hoy 9:41', texto: 'Dijo que sí quiere contratar a María' }, { cuando: 'Hoy 9:30', texto: 'Terminó la entrevista (21 min)' }, { cuando: 'Ayer 4:00 pm', texto: 'Entrevista programada' }, { cuando: 'Lun 11:12', texto: 'María aceptó la solicitud' }] },
  { id: 'p2', horas: 26, nombre: 'Luis Andrade', tipo: 'Cliente', zona: 'Madrid → Los Palos Grandes', etapa: 'Decisión', compita: 'Rosa', nota: '', linea: [{ cuando: 'Hoy 10:05', texto: 'Entrevista terminó, sin respuesta del cliente' }, { cuando: 'Hoy 9:40', texto: 'Entró a la entrevista' }] },
  { id: 'p3', horas: 8, nombre: 'Ana Gómez', tipo: 'Cliente', zona: 'Bogotá → Altamira', etapa: 'Solicitud', compita: 'Daniela', nota: '', linea: [{ cuando: 'Hoy 8:50', texto: 'Envió solicitud a Daniela' }] },
  { id: 'p4', horas: 0, nombre: 'Marta Salcedo', tipo: 'Cliente', zona: 'Panamá → Chacao', etapa: 'Activo', compita: 'María', nota: 'Madre de 82 años, usa bastón.', linea: [{ cuando: 'Mar 10:00', texto: 'Visita completada, 5 estrellas' }, { cuando: 'Lun 3:00 pm', texto: 'Pago confirmado' }] },
  { id: 'p5', horas: 0, nombre: 'Jorge Rivas', tipo: 'Cliente', zona: 'Lima → El Rosal', etapa: 'Entrevista', compita: 'Rosa', nota: '', linea: [{ cuando: 'Hoy 7:20', texto: 'Entrevista confirmada para mañana' }] },
  { id: 'p9', horas: 48, nombre: 'Elena Duarte', tipo: 'Cliente', zona: 'Caracas → La Castellana', etapa: 'Ficha', compita: 'María', nota: '', linea: [{ cuando: 'Hace 2 días', texto: 'Pagó el Plan Compañía' }, { cuando: 'Hace 2 días', texto: 'Aún no completa la ficha del familiar' }] },
  { id: 'p6', nombre: 'María Fuentes', tipo: 'Compita', zona: 'Chacao', nota: 'Muy puntual. Excelente con adultos mayores.', linea: [{ cuando: 'Hoy 9:30', texto: 'Terminó entrevista con Carolina' }, { cuando: 'Mar 10:00', texto: 'Visita completada' }] },
  { id: 'p7', nombre: 'Rosa Linares', tipo: 'Compita', zona: 'Los Palos Grandes', nota: '', linea: [{ cuando: 'Hoy 10:05', texto: 'Aviso de Telegram sin entregar' }] },
  { id: 'p8', nombre: 'Daniela Torres', tipo: 'Compita', zona: 'Altamira', nota: '', linea: [{ cuando: 'Hoy 8:50', texto: 'Nueva solicitud sin responder' }] },
]


const STATS_BASE: Record<string, StatsCompita> = {
  p6: { estado: 'Con cupo', activos: 2, visitas: 14, rating: 4.9, respuesta: 98, inactivoH: 1, canc: 0, tardias: 0 },
  p7: { estado: 'Disponible', activos: 1, visitas: 6, rating: 4.4, respuesta: 62, inactivoH: 30, canc: 1, tardias: 0 },
  p8: { estado: 'Disponible', activos: 0, visitas: 0, rating: 0, respuesta: 40, inactivoH: 80, canc: 2, tardias: 2 },
}
const NOM = ['Carmen', 'Yoselin', 'Gladys', 'Mariela', 'Yaneth', 'Beatriz', 'Alexandra', 'Nelly', 'Irene', 'Milagros', 'Josefina', 'Dayana', 'Karina', 'Omaira', 'Zuleima', 'Flor', 'Aracelis', 'Thais', 'Noris', 'Lisbeth']
const APE = ['Pérez', 'Gómez', 'Rojas', 'Mendoza', 'Silva', 'Castro', 'Ortega', 'Navas', 'Paredes', 'Quintero', 'Salas', 'Vargas', 'Ríos', 'Medina', 'Lara']
const ZONAS = ['Chacao', 'Altamira', 'Los Palos Grandes', 'El Rosal', 'La Castellana', 'Sabana Grande', 'Los Chaguaramos', 'El Paraíso']
const ESTADOS: EstadoCompita[] = ['Disponible', 'Con cupo', 'Con cupo', 'Disponible', 'En pausa', 'Nuevo']
let semilla = 7
const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 }
const GENERADAS: Persona[] = Array.from({ length: 97 }, (_, i) => {
  const estado = ESTADOS[Math.floor(azar() * ESTADOS.length)]
  const nueva = estado === 'Nuevo'
  const stats: StatsCompita = {
    estado,
    activos: nueva || estado === 'En pausa' ? 0 : Math.floor(azar() * 4),
    visitas: nueva ? 0 : Math.floor(azar() * 20),
    rating: nueva ? 0 : Math.round((3.4 + azar() * 1.6) * 10) / 10,
    respuesta: nueva ? 0 : Math.round(35 + azar() * 65),
    inactivoH: Math.floor(azar() * azar() * 120),
    // Cancelaciones de los últimos 30 días (fijas por posición para no alterar el resto de los datos de ejemplo).
    tardias: nueva ? 0 : i % 19 === 0 ? 3 : i % 11 === 0 ? 2 : i % 7 === 0 ? 1 : 0,
    canc: nueva ? 0 : (i % 19 === 0 ? 3 : i % 11 === 0 ? 2 : i % 7 === 0 ? 1 : 0) + (i % 5 === 0 ? 1 : 0),
  }
  const nombre = `${NOM[i % NOM.length]} ${APE[Math.floor(azar() * APE.length)]}`
  return { id: `c${i}`, nombre, tipo: 'Compita', zona: ZONAS[Math.floor(azar() * ZONAS.length)], nota: '', stats, linea: [{ cuando: `Hace ${stats.inactivoH} h`, texto: 'Última actividad' }] }
})
const NOM_CLI = ['Gabriela', 'Ricardo', 'Patricia', 'Fernando', 'Mónica', 'Héctor', 'Silvia', 'Rafael', 'Adriana', 'Eduardo']
const PAISES = ['Miami', 'Madrid', 'Bogotá', 'Panamá', 'Lima', 'Santiago', 'Ciudad de México']
const CLIENTES_GEN: Persona[] = Array.from({ length: 25 }, (_, i) => ({
  id: `k${i}`, nombre: `${NOM_CLI[i % NOM_CLI.length]} ${APE[Math.floor(azar() * APE.length)]}`, tipo: 'Cliente', zona: `${PAISES[Math.floor(azar() * PAISES.length)]} → ${ZONAS[Math.floor(azar() * ZONAS.length)]}`,
  nota: '', linea: [{ cuando: 'Reciente', texto: 'Cliente con visitas activas' }],
}))
const PERSONAS: Persona[] = [...BASE.map((x) => (STATS_BASE[x.id] ? { ...x, stats: STATS_BASE[x.id] } : x)), ...GENERADAS, ...CLIENTES_GEN]

type Urgencia = 'verde' | 'amarillo' | 'rojo'
// Horas en la etapa a partir de las cuales pasa a amarillo y a rojo (propuesta, se ajusta).
const UMBRALES: Record<Etapa, [number, number]> = { Solicitud: [6, 24], Entrevista: [1, 3], Decisión: [2, 24], Pago: [2, 12], Ficha: [24, 48], Activo: [24, 72] }
const URG_ESTILO: Record<Urgencia, string> = { verde: 'bg-[#1f9d6b] text-white', amarillo: 'bg-[#F5B800] text-[var(--purple-dark)]', rojo: 'bg-[#D93A3A] text-white' }
function urgenciaDe(p: Persona): Urgencia {
  if (!p.etapa) return 'verde'
  const [am, ro] = UMBRALES[p.etapa]
  const h = p.horas ?? 0
  return h >= ro ? 'rojo' : h >= am ? 'amarillo' : 'verde'
}


// Qué hace cada botón de la Bandeja (el icono ⓘ que lo acompaña).
const INFO_BOTON_TAREA: Record<string, string> = {
  'Confirmar pago': 'Confirma que el dinero llegó. El cliente puede completar su ficha y agendar, y le llega un correo. Queda anotado quién lo confirmó.',
  'Contactar al compita': 'Abre el contacto del compita para que le escribas por Telegram y preguntes si todo está bien. Al tocarlo, la tarea queda como contactada.',
  'Decidir sobre el compita': 'Abre una ventana para reactivar al compita, darle otra oportunidad o bloquearlo. Tu decisión queda en el Registro de actividad.',
  'Decidir sobre la cuenta': 'Abre una ventana para reactivar la cuenta del cliente, darle otra oportunidad o bloquearla. Tu decisión queda en el Registro de actividad.',
  'Escribir al contacto otra vez': 'Manda otro mensaje a la persona que debía abrir la puerta. No se le dan datos del compita. Cierra la tarea si nadie vuelve a avisar.',
  'Hablar con el compita': 'Abre el contacto del compita para conversar sobre sus cancelaciones. No cambia nada hasta que registres lo que decidiste.',
  'Insistir al compita': 'Le manda de nuevo el aviso por Telegram al compita que no respondió. Queda anotado que se insistió.',
  'Llamar al compita y decidir': 'Te muestra cómo contactar al compita tras salir de una visita por seguridad. Tú decides si se cobra la visita. Nunca le pidas datos por teléfono.',
  'Marcar atendida': 'Indica que ya atendiste la emergencia. Quita la alerta roja y queda anotado quién y cuándo.',
  'Marcar revisada': 'Indica que ya revisaste el mensaje bloqueado. Quita la tarea y queda anotado. No se envía nada a nadie.',
  'Recordar al cliente': 'Le manda un correo de Compaz al cliente para que decida si contrata. No lleva datos del compita.',
  'Recordarle por correo': 'Le manda un correo de Compaz al cliente para que complete la ficha de su familiar. Es lo único que le falta para agendar.',
  'Registrar la llamada': 'Abre una ventana con el plazo, lo que sigue abierto con ese cliente y las cuatro decisiones. Al registrar, la tarea se cierra y queda quién llamó.',
  'Reintentar aviso': 'Vuelve a mandar el aviso que no llegó. Si falla otra vez, la tarea sigue abierta con el motivo del fallo.',
  'Responderle por Telegram': 'Abre el chat para que le respondas al compita su duda por Telegram. Nunca se resuelve por llamada.',
}

type Tarea = { id: string; tipo: string; clienteId: string; compitaId: string; que: string; hace: string; boton: string; resuelta: string }
const TAREAS: Tarea[] = [
  { id: 't0', tipo: 'Emergencia', clienteId: 'p4', compitaId: 'p6', que: 'El compita activó el botón de emergencia durante una visita en curso', hace: 'hace 2 min', boton: 'Marcar atendida', resuelta: 'Atendida ✓' },
  { id: 't1', tipo: 'Pago', clienteId: 'p1', compitaId: 'p6', que: 'URGENTE: el cliente insistió hace 8 min. Dice que ya pagó $75. Referencia COMPAZ-4F7K2Q', hace: 'hace 3 h', boton: 'Confirmar pago', resuelta: 'Pago confirmado ✓' },
  { id: 't2', tipo: 'Decisión', clienteId: 'p2', compitaId: 'p7', que: 'La entrevista terminó y el cliente no ha decidido si contrata', hace: 'hace 3 h', boton: 'Recordar al cliente', resuelta: 'Recordatorio enviado ✓' },
  { id: 't3', tipo: 'Aviso fallido', clienteId: 'p5', compitaId: 'p7', que: 'Telegram no entregó al compita el aviso de nueva solicitud', hace: 'hace 25 min', boton: 'Reintentar aviso', resuelta: 'Reintento enviado ✓' },
  { id: 't5', tipo: 'Contacto bloqueado', clienteId: 'p2', compitaId: 'p7', que: 'Un mensaje del chat intentó compartir un teléfono o correo y fue censurado', hace: 'hace 40 min', boton: 'Marcar revisada', resuelta: 'Revisada ✓' },
  { id: 't4', tipo: 'Sin respuesta', clienteId: 'p3', compitaId: 'p8', que: 'El cliente envió una solicitud y el compita no ha respondido', hace: 'hace 5 h', boton: 'Insistir al compita', resuelta: 'Aviso reenviado ✓' },
]

// Tareas nuevas de los puntos 2 a 5: la escalera las abre sola cuando algo no se resuelve por el camino automático.
const NUEVAS: Tarea[] = [
  { id: 'n1', tipo: 'Nadie abre', clienteId: 'p4', compitaId: 'p6', que: 'El compita llegó (foto enviada) y nadie abre. Van 15 de 30 minutos. Ya se le escribió al contacto en el sitio a los 5 minutos', hace: 'hace 15 min', boton: 'Escribir al contacto otra vez', resuelta: 'Mensaje enviado ✓' },
  { id: 'n2', tipo: 'No me siento seguro', clienteId: 'p2', compitaId: 'p7', que: 'El compita salió de la visita por seguridad. El cliente recibió un aviso neutro. Decide si cobra la visita', hace: 'hace 6 min', boton: 'Llamar al compita y decidir', resuelta: 'Atendida ✓' },
  { id: 'n3', tipo: 'Visita alargada', clienteId: 'p3', compitaId: 'p8', que: 'La visita pasó 25 minutos de su hora de fin y el compita no respondió "¿Todo bien?" en 10 minutos', hace: 'hace 10 min', boton: 'Contactar al compita', resuelta: 'Contactado ✓' },
  { id: 'n4', tipo: 'Ficha incompleta', clienteId: 'p9', compitaId: 'p6', que: 'Pagó hace 2 días y aún no completa la ficha del familiar. No puede agendar su primera cita', hace: 'hace 2 d', boton: 'Recordarle por correo', resuelta: 'Recordatorio enviado ✓' },
  { id: 'n5', tipo: 'Reporte de un compita', clienteId: 'p5', compitaId: 'p7', que: 'El compita reportó un problema con este cliente: quiso arreglar pagos fuera de Compaz, durante la visita, y ya había pasado antes. Marcó no volver con él y pidió que lo llamemos. Llamar antes de mañana 4:00 pm', hace: 'hace 1 h', boton: 'Registrar la llamada', resuelta: 'Llamada registrada ✓' },
  { id: 'n6', tipo: 'Cancelación tardía', clienteId: 'p2', compitaId: 'p8', que: 'El compita canceló con menos de 24 horas. Es su segunda en 30 días: se abre revisión. La cita se reprograma sin costo', hace: 'hace 4 h', boton: 'Hablar con el compita', resuelta: 'Revisada ✓' },
  { id: 'n9', tipo: 'Duda sin resolver', clienteId: 'p4', compitaId: 'p7', que: 'El compita preguntó por la dirección y por cómo entrar, y el bot no pudo resolverlo en 2 intentos. Responder por Telegram, nunca por llamada', hace: 'hace 20 min', boton: 'Responderle por Telegram', resuelta: 'Respondida ✓' },
  { id: 'n10', tipo: 'Contacto bloqueado', clienteId: 'p4', compitaId: 'p7', que: 'Segunda detección en 30 días: este COMPITA compartió un teléfono con un cliente. Su disponibilidad quedó en pausa, sin fecha de fin, y sus visitas programadas en espera. Decide: reactivar, dar otra oportunidad o bloquear', hace: 'hace 35 min', boton: 'Decidir sobre el compita', resuelta: 'Decidido ✓' },
  { id: 'n8', tipo: 'Cambio en el lugar', clienteId: 'p4', compitaId: 'p6', que: 'El cliente cambió quién estará en la visita (agregó a 1 amigo) y el compita no responde si sigue. La visita es en 20 horas, ya pasó la espera de 5 horas. El cliente ya le escribió por el chat', hace: 'hace 3 h', boton: 'Insistir al compita', resuelta: 'Aviso reenviado ✓' },
  { id: 'n7', tipo: 'Contacto bloqueado', clienteId: 'p3', compitaId: 'p7', que: 'Segunda detección en 30 días: este cliente volvió a intentar compartir un teléfono. Su cuenta quedó EN PAUSA, sin fecha de fin, y tiene 1 visita programada (jueves 10:00 am) sobre la que decides. Decide: reactivar, dar otra oportunidad o bloquear', hace: 'hace 50 min', boton: 'Decidir sobre la cuenta', resuelta: 'Decidido ✓' },
]

// Lo que el admin marca en esta sesión queda en el Registro de actividad (en el sistema real se guarda en la base).
type EntradaRegistro = { cuando: string; quien: string; accion: string; motivo: string }
const REGISTRO_EXTRA: EntradaRegistro[] = []
const horaAhora = () => new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })

// Historial de cancelaciones del compita (en la ficha). El interruptor "justificada" las saca de su cuenta.
const MOTIVOS_CANC = ['Enfermedad', 'Problema de transporte', 'Imprevisto personal', 'Emergencia familiar']
function CancelacionesFicha({ p }: { p: Persona }) {
  const s = p.stats!
  const [just, setJust] = useState<Record<number, { quien: string; cuando: string } | undefined>>({})
  const marcar = (i: number, c: { cuando: string; motivo: string }, on: boolean) => {
    const hora = horaAhora()
    setJust((o) => ({ ...o, [i]: on ? { quien: 'Admin Juan', cuando: `hoy ${hora}` } : undefined }))
    REGISTRO_EXTRA.unshift({ cuando: `hoy ${hora}`, quien: 'Admin Juan', accion: `${on ? 'Marcó como justificada' : 'Quitó la justificación de'} una cancelación de ${p.nombre} (${c.cuando}, ${c.motivo})`, motivo: on ? 'Puede dejar de contar en contra del compita' : 'Vuelve a contar en contra del compita' })
  }
  if (s.canc === 0) return <p className="mt-2 text-sm text-[var(--text-mid)]">Sin cancelaciones en los últimos 30 días.</p>
  const lista = Array.from({ length: s.canc }, (_, i) => ({ cuando: `hace ${3 + i * 6} días`, horas: i < s.tardias ? [3, 10, 18][i % 3] : 30 + i * 12, motivo: MOTIVOS_CANC[(i + p.nombre.length) % MOTIVOS_CANC.length] }))
  const cuentan = lista.filter((c, i) => c.horas < 24 && !just[i]).length
  return (
    <>
      <p className="mt-1 text-sm text-[var(--text-mid)]">{s.canc} en 30 días, {s.tardias} con menos de 24 horas de aviso. Cuentan en su contra: <b>{cuentan}</b>. Con 2 se abre una revisión y con 3 se pausan sus solicitudes nuevas.</p>
      <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-xl border border-[var(--border-muted)]">
        {lista.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <div className="min-w-[9rem] flex-1"><div className="font-bold">{c.cuando}</div><div className="text-[var(--text-mid)]">{c.motivo} · avisó con {c.horas} h {c.horas < 24 ? <b className="text-[#92400E]">(tardía)</b> : '(a tiempo)'}</div></div>
            {c.horas < 24 && <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={!!just[i]} onChange={(e) => marcar(i, c, e.target.checked)} className="h-5 w-5" />Justificada</label>}
            {just[i] && <div className="w-full text-xs text-[var(--text-mid)]">Marcada por {just[i]!.quien} · {just[i]!.cuando}. Queda en el Registro de actividad.</div>}
          </li>
        ))}
      </ul>
    </>
  )
}

// ── Chat entre cliente y compita, visible solo para el equipo ───────────────────────────────────────
// Se abre desde la Bandeja, Visitas y la ficha del cliente. Abrirlo queda anotado en el Registro de actividad.
type MensajeChat = { de: 'Cliente' | 'Compita' | 'Compaz'; t: string; cuando: string; censurado?: boolean }
const VerChatCtx = createContext<(clienteId: string, compitaId: string) => void>(() => {})
// Rol de quien usa el panel. Los administradores (correo de administrador) no escriben motivo al ver datos sensibles;
// cualquier otra persona con acceso (colaborador) debe indicar un motivo, y no tiene acceso al 100 %.
type Rol = 'admin' | 'colaborador'
const RolCtx = createContext<Rol>('admin')
const NOMBRE_ROL: Record<Rol, string> = { admin: 'Admin Juan', colaborador: 'Colaborador Luis' }

// ── Permisos por colaborador ─────────────────────────────────────────────────────────────────────────
// El administrador activa o desactiva cada permiso de cada colaborador con interruptores (sí/no). Los cambios rigen
// al instante, quedan en el Registro de actividad y se guardan en este navegador para la maqueta.
type Permiso = 'monitorear' | 'atender' | 'chats' | 'telefonos' | 'pagos' | 'cuentas' | 'ajustes_ver' | 'ajustes_editar' | 'invitar'
const PERMISOS_LISTA: { id: Permiso; t: string; d: string }[] = [
  { id: 'monitorear', t: 'Ver Seguimiento, Personas y Visitas', d: 'Monitorear a compitas y clientes.' },
  { id: 'atender', t: 'Ver la Bandeja y atender tareas del día', d: 'Insistir a un compita, reintentar un aviso, marcar revisada.' },
  { id: 'chats', t: 'Ver el chat entre cliente y compita', d: 'Pide un motivo cada vez y queda anotado.' },
  { id: 'telefonos', t: 'Ver teléfonos y datos sensibles', d: 'Pide un motivo cada vez y queda anotado.' },
  { id: 'pagos', t: 'Confirmar pagos y ver el historial de pagos', d: 'Dinero: conviene dejarlo solo para administradores.' },
  { id: 'cuentas', t: 'Pausar, reactivar o bloquear cuentas', d: 'Decisiones sobre clientes y compitas.' },
  { id: 'ajustes_ver', t: 'Ver Ajustes', d: 'Solo lectura: precios, plazos y textos.' },
  { id: 'ajustes_editar', t: 'Cambiar Ajustes', d: 'Cambia precios, plazos y textos para todo el sistema.' },
  { id: 'invitar', t: 'Invitar clientes y compitas', d: 'Mandar invitaciones de acceso.' },
]
// Lo recomendado para un colaborador nuevo (el administrador lo cambia cuando quiera).
const PERMISOS_BASE: Record<Permiso, boolean> = { monitorear: true, atender: true, chats: true, telefonos: true, pagos: false, cuentas: false, ajustes_ver: true, ajustes_editar: false, invitar: false }
type Colaborador = { id: string; nombre: string; correo: string; desde: string; permisos: Record<Permiso, boolean> }
const COLABS_INICIALES: Colaborador[] = [{ id: 'luis', nombre: 'Luis', correo: 'luis@micompaz.com', desde: 'Invitado por Juan el 2 nov', permisos: { ...PERMISOS_BASE } }]
const CLAVE_LS = 'compaz_proto_colaboradores'
type PermCtxValor = { colabs: Colaborador[]; cambiar: (id: string, p: Permiso, v: boolean) => void; restablecer: (id: string) => void; invitar: (correo: string) => void }
const PermCtx = createContext<PermCtxValor>({ colabs: COLABS_INICIALES, cambiar: () => {}, restablecer: () => {}, invitar: () => {} })
/** ¿Puede quien usa el panel hacer esto? Un administrador siempre; el colaborador (Luis en la maqueta) solo si se lo activaron. */
function usePuede(): (p: Permiso) => boolean {
  const rol = useContext(RolCtx)
  const { colabs } = useContext(PermCtx)
  const yo = colabs[0]
  return (p) => rol === 'admin' || !!yo?.permisos[p]
}

// Almacén sencillo de colaboradores: se lee una vez del navegador y avisa a quien lo usa cuando cambia.
let colabsGuardados: Colaborador[] | null = null
const oyentesColabs = new Set<() => void>()
function leerColabs(): Colaborador[] {
  if (colabsGuardados) return colabsGuardados
  colabsGuardados = COLABS_INICIALES
  try {
    const g = typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE_LS) : null
    const v = g ? JSON.parse(g) : null
    if (Array.isArray(v) && v.length) colabsGuardados = v as Colaborador[]
  } catch { /* sin almacenamiento: se usan los valores iniciales */ }
  return colabsGuardados
}
function escribirColabs(n: Colaborador[]) {
  colabsGuardados = n
  try { localStorage.setItem(CLAVE_LS, JSON.stringify(n)) } catch { /* la maqueta sigue funcionando sin guardar */ }
  oyentesColabs.forEach((f) => f())
}
const suscribirColabs = (f: () => void) => { oyentesColabs.add(f); return () => { oyentesColabs.delete(f) } }
const MOTIVOS_CHAT = ['Reclamo del cliente', 'Alerta de contacto compartido', 'Revisión de calidad de la visita', 'Otro (explicar)']

function conversacion(clienteId: string, compitaId: string): MensajeChat[] {
  const conBloqueo = TODAS_TAREAS.some((t) => t.tipo === 'Contacto bloqueado' && t.clienteId === clienteId && t.compitaId === compitaId)
  const base: MensajeChat[] = [
    { de: 'Compaz', t: 'Se abrió el chat para coordinar la próxima visita. Recuerda: no se pueden compartir teléfonos ni correos; quien lo haga puede ser penalizado.', cuando: 'hace 3 d, 10:02' },
    { de: 'Compita', t: 'Hola, vi que quieres otra visita. ¿Qué día te queda bien?', cuando: 'hace 3 d, 10:05' },
    { de: 'Cliente', t: 'Hola, ¿te sirve el jueves en la mañana?', cuando: 'hace 3 d, 10:31' },
    { de: 'Compita', t: 'Sí, el jueves a las 10:00 am me queda perfecto.', cuando: 'hace 3 d, 10:40' },
  ]
  const bloqueo: MensajeChat[] = conBloqueo ? [
    { de: 'Cliente', t: '[contacto eliminado]', cuando: 'hace 2 d, 18:12', censurado: true },
    { de: 'Compaz', t: 'Por seguridad no se pueden compartir contactos. Este es el primer aviso.', cuando: 'hace 2 d, 18:12' },
    { de: 'Cliente', t: '[contacto eliminado]', cuando: 'hace 50 min', censurado: true },
    { de: 'Compaz', t: 'Se avisó al equipo y la cuenta quedó en pausa.', cuando: 'hace 50 min' },
  ] : [{ de: 'Cliente', t: 'Perfecto, gracias. Nos vemos el jueves.', cuando: 'hace 3 d, 10:44' }]
  return [...base, ...bloqueo]
}

function MotivoDialog({ titulo, texto, onListo, onCancelar }: { titulo: string; texto: string; onListo: (motivo: string) => void; onCancelar: () => void }) {
  const [elegido, setElegido] = useState('')
  const [detalle, setDetalle] = useState('')
  const otro = elegido === MOTIVOS_CHAT[3]
  const listo = !!elegido && (!otro || detalle.trim().length >= 5)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancelar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo} className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <h2 className="text-xl font-extrabold">{titulo}</h2>
        <p className="mt-1 text-sm text-[var(--text-mid)]">{texto}</p>
        <div className="mt-3 grid gap-2">
          {MOTIVOS_CHAT.map((m) => <button key={m} onClick={() => setElegido(m)} aria-pressed={elegido === m} className={`min-h-12 rounded-2xl border-2 px-4 text-left font-bold ${elegido === m ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}>{m}</button>)}
        </div>
        {otro && <label className="mt-3 block text-base font-bold">Explica el motivo<textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-[var(--border-muted)] p-3 text-base font-normal" /></label>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="min-h-12 rounded-xl border border-[var(--border-muted)] font-bold">Cancelar</button>
          <div className="flex items-center gap-1">
            <button disabled={!listo} onClick={() => onListo(otro ? `Otro: ${detalle.trim()}` : elegido)} className="min-h-12 flex-1 rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Continuar</button>
            <InfoBoton que="Continuar" texto="Guarda tu motivo junto con tu nombre en el Registro de actividad y te muestra el dato. Si no lo necesitas, cancela." alineado="izquierda" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatAdmin({ clienteId, compitaId, onClose }: { clienteId: string; compitaId: string; onClose: () => void }) {
  const cli = PERSONAS.find((x) => x.id === clienteId)
  const cmp = PERSONAS.find((x) => x.id === compitaId)
  const msgs = useMemo(() => conversacion(clienteId, compitaId), [clienteId, compitaId])
  const rol = useContext(RolCtx)
  // El administrador entra directo; el colaborador debe indicar un motivo antes de ver la conversación.
  const [motivo, setMotivo] = useState<string | null>(rol === 'admin' ? 'Sin motivo requerido (administrador)' : null)
  const [elegido, setElegido] = useState('')
  const [detalle, setDetalle] = useState('')
  const otro = elegido === MOTIVOS_CHAT[3]
  const motivoListo = !!elegido && (!otro || detalle.trim().length >= 5)
  // Consultar una conversación es consultar un dato sensible: queda anotado (una vez por apertura).
  const anotado = useRef(false) // una sola anotación por apertura, aunque el efecto se ejecute dos veces
  useEffect(() => {
    if (!cli || !cmp || !motivo || anotado.current) return
    anotado.current = true
    REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: NOMBRE_ROL[rol], accion: `Vio el chat entre ${cli.nombre} y ${cmp.nombre}`, motivo })
  }, [cli, cmp, motivo, rol])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  if (!cli || !cmp) return null
  if (!motivo) {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Motivo para ver el chat" className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">
          <h2 className="text-xl font-extrabold">¿Por qué necesitas ver este chat?</h2>
          <p className="mt-1 text-sm text-[var(--text-mid)]">Es una conversación privada entre {cli.nombre} y {cmp.nombre}. Como colaborador, debes indicar un motivo. Queda anotado junto con tu nombre.</p>
          <div className="mt-3 grid gap-2">
            {MOTIVOS_CHAT.map((m) => <button key={m} onClick={() => setElegido(m)} aria-pressed={elegido === m} className={`min-h-12 rounded-2xl border-2 px-4 text-left font-bold ${elegido === m ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}>{m}</button>)}
          </div>
          {otro && <label className="mt-3 block text-base font-bold">Explica el motivo<textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-[var(--border-muted)] p-3 text-base font-normal" /></label>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={onClose} className="min-h-12 rounded-xl border border-[var(--border-muted)] font-bold">Cancelar</button>
            <div className="flex items-center gap-1">
              <button disabled={!motivoListo} onClick={() => setMotivo(otro ? `Otro: ${detalle.trim()}` : elegido)} className="min-h-12 flex-1 rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Ver el chat</button>
              <InfoBoton que="Ver el chat" texto="Abre la conversación privada entre el cliente y el compita. Tu motivo y tu nombre quedan en el Registro de actividad." alineado="izquierda" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  const color: Record<MensajeChat['de'], string> = { Cliente: 'bg-[var(--purple)]/10 border-[var(--purple)]/30', Compita: 'bg-[var(--orange)]/10 border-[var(--orange)]/30', Compaz: 'bg-[var(--warm-gray)] border-[var(--border-muted)]' }
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Chat entre cliente y compita" className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-light)]">Chat</div>
            <h2 className="text-xl font-extrabold">{cli.nombre} <span className="text-[var(--text-light)]">↔</span> {cmp.nombre}</h2>
          </div>
          <button onClick={onClose} className="min-h-10 rounded-xl border border-[var(--border-muted)] px-3 font-bold" aria-label="Cerrar chat">Cerrar</button>
        </div>
        <p className="mt-3 rounded-xl bg-[#FFFBEB] p-3 text-sm font-bold text-[#92400E]">Solo el equipo ve esta conversación. Quedó anotado en el Registro de actividad que la abriste{rol === 'colaborador' ? ` (motivo: ${motivo})` : ''}.</p>
        <ol className="mt-4 grid gap-2" aria-label="Mensajes">
          {msgs.map((m, i) => (
            <li key={i} className={`rounded-2xl border p-3 ${color[m.de]} ${m.de === 'Cliente' ? 'ml-6' : m.de === 'Compita' ? 'mr-6' : ''}`}>
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--text-mid)]"><span>{m.de}</span><span className="font-normal normal-case text-[var(--text-light)]">{m.cuando}</span></div>
              <div className="mt-1 text-base">{m.t}</div>
              {m.censurado && <div className="mt-1 text-xs font-bold text-[#991B1B]">Se intentó compartir un contacto. Se borró antes de llegar a la otra persona.</div>}
            </li>
          ))}
        </ol>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => { onClose() }} className="min-h-12 rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Ver ficha del cliente</button>
          <button onClick={() => { onClose() }} className="min-h-12 rounded-xl border-2 border-[var(--orange)] font-extrabold text-[var(--orange-dark)]">Ver ficha del compita</button>
        </div>
      </aside>
    </div>
  )
}

/** Datos de contacto de prueba. En el sistema real salen de la base y solo los entrega el servidor con permiso. */
function datosContacto(p: Persona) {
  const num = p.id.replace(/\D/g, '').padStart(4, '0').slice(-4)
  const telefono = `${p.tipo === 'Cliente' ? '+1 305' : '+58 414'} 555 ${num}`
  const correo = `${p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`
  return { telefono, digitos: telefono.replace(/\D/g, ''), correo }
}

/** Iconos para escribirle al compita por WhatsApp o correo. El administrador entra directo; un colaborador necesita el permiso
 *  de teléfonos y dar un motivo. Cada apertura queda en el registro de actividad. */
function ContactoCompita({ p, etiqueta = false }: { p: Persona; etiqueta?: boolean }) {
  const puede = usePuede()
  const rol = useContext(RolCtx)
  const [pidiendo, setPidiendo] = useState<null | 'whatsapp' | 'correo'>(null)
  if (p.tipo !== 'Compita' || !puede('telefonos')) return null
  const { digitos, correo } = datosContacto(p)
  const abrirCanal = (canal: 'whatsapp' | 'correo', motivo: string) => {
    setPidiendo(null)
    REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: NOMBRE_ROL[rol], accion: `Abrió ${canal === 'whatsapp' ? 'WhatsApp' : 'el correo'} para escribirle a ${p.nombre}`, motivo })
    if (canal === 'whatsapp') window.open(`https://wa.me/${digitos}`, '_blank', 'noopener,noreferrer')
    else window.location.href = `mailto:${correo}`
  }
  const pedir = (canal: 'whatsapp' | 'correo') => (rol === 'admin' ? abrirCanal(canal, 'Sin motivo requerido (administrador)') : setPidiendo(canal))
  const base = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--border-muted)] bg-white px-2.5 text-sm font-bold hover:bg-[var(--warm-gray)]'
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => pedir('whatsapp')} className={base} title={`Escribirle a ${p.nombre} por WhatsApp`} aria-label={`Escribirle a ${p.nombre} por WhatsApp`}>
{etiqueta && <span>WhatsApp</span>}
      </button>
      <button type="button" onClick={() => pedir('correo')} className={base} title={`Escribirle a ${p.nombre} por correo`} aria-label={`Escribirle a ${p.nombre} por correo`}>
{etiqueta && <span>Correo</span>}
      </button>
      <InfoBoton que="Escribirle por WhatsApp o correo" texto="Abre WhatsApp o tu correo para escribirle a esta persona. Es un dato sensible: si no eres administrador te pide un motivo, y queda anotado en Actividad junto con tu nombre. Compaz no guarda la conversación." />
      {pidiendo && <MotivoDialog titulo={`¿Por qué le escribes a ${p.nombre}?`} texto="Es un dato de contacto sensible. Debes indicar un motivo. Queda anotado junto con tu nombre." onListo={(m) => abrirCanal(pidiendo, m)} onCancelar={() => setPidiendo(null)} />}
    </span>
  )
}

function Ficha({ p, onClose }: { p: Persona; onClose: () => void }) {
  const verChat = useContext(VerChatCtx)
  const puede = usePuede()
  const rolFicha = useContext(RolCtx)
  const [pidiendoTel, setPidiendoTel] = useState(false)
  const [telVisible, setTelVisible] = useState(false)
  const { telefono } = datosContacto(p)
  const revelarTel = (motivo: string) => {
    setTelVisible(true); setPidiendoTel(false)
    REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: NOMBRE_ROL[rolFicha], accion: `Vio el teléfono de ${p.nombre}`, motivo })
  }
  const compitaDe = p.tipo === 'Cliente' && p.compita ? PERSONAS.find((x) => x.tipo === 'Compita' && x.nombre.startsWith(p.compita!)) : undefined
  const [nota, setNota] = useState(p.nota)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-light)]">{p.tipo}</div>
            <h2 className="text-2xl font-extrabold">{p.nombre}</h2>
            <div className="text-[var(--text-mid)]">{p.zona}</div>
            {puede('telefonos') && (
              <div className="mt-1 text-sm">Teléfono: {telVisible ? <b>{telefono}</b> : <><b>+•• ••• ••• ••••</b> <button onClick={() => (rolFicha === 'admin' ? revelarTel('Sin motivo requerido (administrador)') : setPidiendoTel(true))} className="ml-1 font-bold text-[var(--orange-dark)] underline">Ver teléfono</button><InfoBoton que="Ver teléfono" texto="Muestra el teléfono completo. Si eres colaborador, te pide un motivo. Cada vez que se abre queda anotado quién, cuándo y por qué." alineado="izquierda" /></>}</div>
            )}
          </div>
          <button onClick={onClose} className="min-h-10 rounded-xl border border-[var(--border-muted)] px-3 font-bold" aria-label="Cerrar ficha">Cerrar</button>
        </div>
        {p.tipo === 'Compita' && <div className="mt-3"><ContactoCompita p={p} etiqueta /></div>}
        {p.etapa && <div className="mt-3 inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-sm font-bold">Etapa: {p.etapa}{p.compita ? ` · con ${p.compita}` : ''}</div>}
        {compitaDe && puede('chats') && <div className="mt-4 flex items-center gap-1"><button onClick={() => { onClose(); verChat(p.id, compitaDe.id) }} className="min-h-12 flex-1 rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Ver el chat con {compitaDe.nombre}</button><InfoBoton que="Ver el chat" texto="Abre la conversación privada entre este cliente y su compita. Es solo lectura y queda anotado en el Registro de actividad que la abriste." /></div>}
        {pidiendoTel && <MotivoDialog titulo="¿Por qué necesitas ver el teléfono?" texto={`Es un dato sensible de ${p.nombre}. Debes indicar un motivo. Queda anotado junto con tu nombre.`} onListo={revelarTel} onCancelar={() => setPidiendoTel(false)} />}
        <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Línea de tiempo</h3>
        <ol className="mt-3 border-l-2 border-[var(--border-muted)] pl-4">
          {p.linea.map((l, i) => (
            <li key={i} className="relative pb-4">
              <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-[var(--orange)]" />
              <div className="text-xs text-[var(--text-light)]">{l.cuando}</div>
              <div>{l.texto}</div>
            </li>
          ))}
        </ol>
        {p.tipo === 'Compita' && p.stats && (<><h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Cancelaciones</h3><CancelacionesFicha p={p} /></>)}
        <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Notas internas</h3>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escribe una nota que solo ve el equipo…" className="mt-2 min-h-24 w-full rounded-xl border border-[var(--border-muted)] p-3 text-base" />
        <p className="mt-2 text-xs text-[var(--text-light)]">Solo el admin ve esta ficha. Cliente y compita nunca ven el contacto del otro.</p>
      </aside>
    </div>
  )
}

const EXTRA: Tarea[] = Array.from({ length: 26 }, (_, i) => {
  const base = TAREAS.slice(1)[i % (TAREAS.length - 1)]
  return { ...base, id: `x${i}`, clienteId: `p${1 + (i % 5)}`, compitaId: `p${6 + (i % 3)}`, hace: `hace ${2 + i} h` }
})
const TODAS_TAREAS = [...TAREAS, ...NUEVAS, ...EXTRA]
const TIPOS = ['Todas', 'Emergencia', 'No me siento seguro', 'Nadie abre', 'Visita alargada', 'Pago', 'Decisión', 'Ficha incompleta', 'Cambio en el lugar', 'Duda sin resolver', 'Reporte de un compita', 'Cancelación tardía', 'Aviso fallido', 'Sin respuesta', 'Contacto bloqueado']
const PAGINA = 10
// Etiquetas cortas para que los filtros quepan en dos líneas (el filtro sigue usando el nombre completo).
const ETIQ_TIPO: Record<string, string> = { 'No me siento seguro': 'Inseguro', 'Visita alargada': 'Alargada', 'Ficha incompleta': 'Ficha', 'Cambio en el lugar': 'Cambio lugar', 'Duda sin resolver': 'Dudas', 'Reporte de un compita': 'Reporte', 'Cancelación tardía': 'Cancelación', 'Aviso fallido': 'Fallido', 'Sin respuesta': 'Sin resp.', 'Contacto bloqueado': 'Contacto' }


// Registrar la llamada al compita que reportó un problema: el plazo, lo que sigue abierto con ese cliente y la decisión. Queda en el Registro de actividad.
const RESULTADOS_LLAMADA = [
  { id: 'resuelto', t: 'Resuelto', d: 'Ya hablaste con el compita y no hace falta nada más. Se cierra la tarea y queda anotado quién llamó y cuándo.' },
  { id: 'hablar_cliente', t: 'Hablar con el cliente', d: 'Tras hablar con el compita, falta llamar o escribirle al cliente. Se cierra esta tarea y queda anotado; el seguimiento con el cliente lo haces tú.' },
  { id: 'mantener', t: 'Mantener el bloqueo', d: 'Decides que el compita no vuelve con este cliente. El bloqueo sigue y ese cliente no podrá pedirle más visitas.' },
  { id: 'levantar', t: 'Levantar el bloqueo', d: 'Decides que no hacía falta separarlos. El cliente vuelve a poder pedirle visitas a este compita.' },
]
function LlamadaReporte({ cliente, compita, onListo, onCancelar }: { cliente: string; compita: string; onListo: (id: string, canceladas: boolean) => void; onCancelar: () => void }) {
  const [sel, setSel] = useState('')
  const [canceladas, setCanceladas] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancelar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Registrar la llamada" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <h2 className="text-xl font-extrabold">Llamada a {compita}</h2>
        <p className="mt-1 rounded-xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">Llamar antes de mañana 4:00 pm. Es el plazo que se le prometió (24 horas). Si pasa sin llamada, el sistema te vuelve a avisar.</p>
        <p className="mt-2 text-sm text-[var(--text-mid)]">Reporte sobre {cliente}: quiso arreglar pagos fuera de Compaz. Recuerda: no le pidas datos por teléfono; escucha y decide.</p>
        <div className="mt-3 rounded-2xl border border-[var(--border-muted)] p-3 text-sm">
          <div className="font-extrabold">Sigue abierto con este cliente</div>
          <div className="text-[var(--text-mid)]">1 visita (jueves 5 nov, 10:00 am) y 1 solicitud.</div>
          {canceladas ? <div role="status" className="mt-2 font-bold text-green-700">✓ Canceladas sin costo para el cliente. Se le avisó sin decirle el motivo.</div> : (
            <div className="mt-2 flex items-center gap-1">
              <button onClick={() => setCanceladas(true)} className="min-h-12 flex-1 rounded-xl border-2 border-[#991B1B] font-extrabold text-[#991B1B]">Cancelar y avisar al cliente</button>
              <InfoBoton que="Cancelar y avisar al cliente" texto="Cancela la visita y la solicitud abiertas entre este compita y este cliente. Al cliente se le devuelve el crédito y recibe un aviso neutro, sin el motivo. Al compita no le cuenta como cancelación tardía. No se puede deshacer." />
            </div>
          )}
        </div>
        <div className="mt-3 grid gap-2">
          <div className="text-sm font-bold text-[var(--text-mid)]">Después de llamar, registra qué decidiste:</div>
          {RESULTADOS_LLAMADA.map((o) => (
            <div key={o.id} className="flex items-center gap-1">
              <button onClick={() => setSel(o.id)} aria-pressed={sel === o.id} className={`flex-1 rounded-2xl border-2 px-4 py-3 text-left ${sel === o.id ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}><div className="font-extrabold">{o.t}</div></button>
              <InfoBoton que={o.t} texto={o.d} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="min-h-12 rounded-xl border border-[var(--border-muted)] font-bold">Cerrar</button>
          <div className="flex items-center gap-1">
            <button disabled={!sel} onClick={() => onListo(sel, canceladas)} className="min-h-12 flex-1 rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Registrar</button>
            <InfoBoton que="Registrar la llamada" texto="Guarda quién llamó, cuándo y qué decidiste, y cierra la tarea. Si decidiste levantar el bloqueo, el cliente vuelve a poder pedirle visitas a este compita." alineado="izquierda" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Decidir sobre una cuenta pausada: el administrador elige qué pasa. Queda en el Registro de actividad.
const OPCIONES_CUENTA = [
  { id: 'reactivar', t: 'Reactivar la cuenta', d: 'Vuelve a usar el sistema con normalidad y sus visitas en espera siguen.' },
  { id: 'otra', t: 'Dar otra oportunidad', d: 'Se reactiva con una advertencia por escrito. Si se repite, se bloquea.' },
  { id: 'bloquear', t: 'Bloquear la cuenta', d: 'Pierde el acceso. Sus visitas en espera se cancelan y se avisa a la otra parte.' },
]
function DecisionCuenta({ cliente, compita, onListo, onCancelar }: { cliente: string; compita: string; onListo: (id: string) => void; onCancelar: () => void }) {
  const [sel, setSel] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancelar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Decidir sobre la cuenta" className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <h2 className="text-xl font-extrabold">¿Qué hacemos con la cuenta?</h2>
        <p className="mt-1 text-sm text-[var(--text-mid)]">Cuenta en pausa por compartir contactos ({cliente}, con {compita}). Antes de decidir puedes revisar el chat. Tu decisión queda anotada.</p>
        <div className="mt-3 grid gap-2">
          {OPCIONES_CUENTA.map((o) => (
            <button key={o.id} onClick={() => setSel(o.id)} aria-pressed={sel === o.id} className={`rounded-2xl border-2 px-4 py-3 text-left ${sel === o.id ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}>
              <div className="font-extrabold">{o.t}</div><div className="text-sm text-[var(--text-mid)]">{o.d}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="min-h-12 rounded-xl border border-[var(--border-muted)] font-bold">Cancelar</button>
          <button disabled={!sel} onClick={() => onListo(sel)} className="min-h-12 rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Confirmar decisión</button>
        </div>
      </div>
    </div>
  )
}

function Bandeja({ abrir }: { abrir: (id: string) => void }) {
  const verChat = useContext(VerChatCtx)
  const puede = usePuede()
  const [decidiendo, setDecidiendo] = useState<string | null>(null)
  const rol = useContext(RolCtx)
  // Confirmar pagos y decidir sobre una cuenta pausada dependen de su permiso.
  const bloqueada = (t: Tarea) => (t.tipo === 'Pago' && !puede('pagos')) || (/^Decidir/.test(t.boton) && !puede('cuentas'))
  const [hechas, setHechas] = useState<Record<string, boolean>>({})
  const [tipo, setTipo] = useUrlState('tipo', 'Todas')
  const [mostrar, setMostrar] = useState(PAGINA)
  const activas = TODAS_TAREAS.filter((t) => !hechas[t.id])
  const lista = activas.filter((t) => tipo === 'Todas' || t.tipo === tipo)
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Requiere tu atención</h1>
      <p className="text-[var(--text-mid)]">{activas.length ? `${activas.length} cosas esperando` : 'Todo al día'}</p>

      {activas.some((t) => t.tipo === 'Emergencia') && (
        <div role="alert" className="mt-3 rounded-xl border-2 border-[#D93A3A] bg-[#FEF2F2] px-4 py-3 font-extrabold text-[#991B1B]">
          {activas.filter((t) => t.tipo === 'Emergencia').length} emergencia activa. Atiéndela antes que cualquier otra tarea.
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5" role="group" aria-label="Filtrar por tipo de tarea">
        <InfoBoton que="Filtrar por tipo de tarea" texto="Muestra solo un tipo de tarea. El número es cuántas hay de cada tipo. No resuelve ni cambia nada." alineado="izquierda" />
        {TIPOS.filter((t) => t === 'Todas' || t === tipo || activas.some((x) => x.tipo === t)).map((t) => {
          const n = t === 'Todas' ? activas.length : activas.filter((x) => x.tipo === t).length
          return (
            <button key={t} onClick={() => { setTipo(t); setMostrar(PAGINA) }} aria-pressed={tipo === t} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${tipo === t ? 'bg-[var(--purple)] text-white' : 'text-[var(--text-mid)] hover:bg-[var(--warm-gray)]'}`}>
              {ETIQ_TIPO[t] ?? t} <span className="opacity-60">{n}</span>
            </button>
          )
        })}
      </div>

      <ul className="mt-3 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {lista.slice(0, mostrar).map((t) => {
          const cli = PERSONAS.find((x) => x.id === t.clienteId)!
          const cmp = PERSONAS.find((x) => x.id === t.compitaId)!
          return (
            <li key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${t.tipo === 'Emergencia' ? 'border-l-4 border-[#D93A3A] bg-[#FEF2F2]' : ''}`}>
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <button onClick={() => abrir(cli.id)} className="flex min-w-0 items-center gap-1 font-extrabold hover:underline">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--purple)]" />
                    <span className="truncate">{cli.nombre}</span>
                    <span className="rounded bg-[var(--purple)]/10 px-1 text-[10px] font-extrabold uppercase text-[var(--purple)]">Cliente</span>
                  </button>
                  <button onClick={() => abrir(cmp.id)} className="flex min-w-0 items-center gap-1 font-bold text-[var(--text-mid)] hover:underline">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--orange)]" />
                    <span className="truncate">{cmp.nombre}</span>
                    <span className="rounded bg-[var(--orange)]/15 px-1 text-[10px] font-extrabold uppercase text-[var(--orange-dark)]">Compita</span>
                  </button>
                  <ContactoCompita p={cmp} />
                  <span className="text-xs text-[var(--text-light)]">{t.hace}</span>
                </div>
                <div className="line-clamp-2 text-sm text-[var(--text-mid)]">{t.que}</div>
              </div>
              {puede('chats') && <button onClick={() => verChat(cli.id, cmp.id)} aria-label={`Ver el chat de ${cli.nombre} y ${cmp.nombre}`} className="min-h-10 shrink-0 rounded-xl border border-[var(--border-muted)] bg-white px-3 text-sm font-bold text-[var(--text-mid)]">Chat</button>}
              <span className="flex shrink-0 items-center"><button disabled={bloqueada(t)} title={bloqueada(t) ? 'No tienes este permiso. Pídeselo a un administrador.' : undefined} onClick={() => (/^Decidir|^Registrar la llamada/.test(t.boton) ? setDecidiendo(t.id) : setHechas((h) => ({ ...h, [t.id]: true })))} className="min-h-10 shrink-0 rounded-xl bg-[var(--orange)] disabled:opacity-40 px-3 text-sm font-extrabold text-white active:bg-[var(--orange-dark)]">{t.boton}</button><InfoBoton que={t.boton} texto={INFO_BOTON_TAREA[t.boton] ?? 'Hace lo que dice el botón y deja anotado quién lo hizo y cuándo.'} alineado="izquierda" /></span>
            </li>
          )
        })}
        {!lista.length && <li className="p-6 text-center text-[var(--text-light)]">Nada pendiente en esta categoría</li>}
      </ul>

      {lista.length > mostrar && (
        <button onClick={() => setMostrar(mostrar + PAGINA)} className="mt-3 min-h-12 w-full rounded-xl border border-[var(--border-muted)] bg-white font-bold text-[var(--text-mid)]">
          Ver {Math.min(PAGINA, lista.length - mostrar)} más ({lista.length - mostrar} restantes)
        </button>
      )}
      {decidiendo && (() => {
        const t = TODAS_TAREAS.find((x) => x.id === decidiendo)!
        const cli = PERSONAS.find((x) => x.id === t.clienteId)!
        const cmp = PERSONAS.find((x) => x.id === t.compitaId)!
        if (t.boton === 'Registrar la llamada') return <LlamadaReporte cliente={cli.nombre} compita={cmp.nombre} onCancelar={() => setDecidiendo(null)} onListo={(op, canc) => {
          REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: NOMBRE_ROL[rol], accion: `Llamada a ${cmp.nombre}: ${RESULTADOS_LLAMADA.find((o) => o.id === op)!.t}${canc ? ' (canceló lo abierto con el cliente)' : ''}`, motivo: `Reporte sobre ${cli.nombre}` })
          setHechas((h) => ({ ...h, [t.id]: true })); setDecidiendo(null)
        }} />
        return <DecisionCuenta cliente={cli.nombre} compita={cmp.nombre} onCancelar={() => setDecidiendo(null)} onListo={(op) => {
          REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: NOMBRE_ROL[rol], accion: `${OPCIONES_CUENTA.find((o) => o.id === op)!.t}: ${cli.nombre}`, motivo: 'Cuenta en pausa por compartir contactos' })
          setHechas((h) => ({ ...h, [t.id]: true })); setDecidiendo(null)
        }} />
      })()}
    </section>
  )
}

function Seguimiento({ abrir }: { abrir: (id: string) => void }) {
  const [etapa, setEtapa] = useUrlState('etapa', 'Todos')
  const clientes = PERSONAS.filter((p) => p.etapa)
  const lista = clientes.filter((p) => etapa === 'Todos' || p.etapa === etapa)
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Seguimiento</h1>
      <p className="text-[var(--text-mid)]">Dónde está cada cliente. Elige una etapa para ver su lista.</p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
        <div className="col-span-full flex items-center gap-1 text-xs font-bold text-[var(--text-light)]">Etapa del cliente <InfoBoton que="Filtrar por etapa" texto="Cada cuadro es una etapa del proceso del cliente y cuántos hay en ella. Tócalo para ver solo esos clientes. No cambia nada." alineado="izquierda" /></div>
        {['Todos', ...ETAPAS].map((et) => {
          const n = et === 'Todos' ? clientes.length : clientes.filter((p) => p.etapa === et).length
          const activa = etapa === et
          return (
            <button key={et} onClick={() => setEtapa(et)} aria-pressed={activa} className={`min-h-16 rounded-2xl border-2 px-2 py-2 text-center ${activa ? 'border-[var(--purple)] bg-[var(--purple)] text-white' : 'border-[var(--border-muted)] bg-white'}`}>
              <div className="text-2xl font-extrabold leading-none">{n}</div>
              <div className="mt-1 text-xs font-bold">{et}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-mid)]">
        <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-[#1f9d6b] align-middle" />Al día</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-[#F5B800] align-middle" />Esperando más de lo normal</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-[#D93A3A] align-middle" />Atascado</span>
      </div>
      <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {lista.map((p) => (
          <li key={p.id}>
            <div role="button" tabIndex={0} onClick={() => abrir(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') abrir(p.id) }} className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-[var(--warm-gray)]">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold ${URG_ESTILO[urgenciaDe(p)]}`} title={`${p.horas ?? 0} h en esta etapa`}>{p.nombre[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-extrabold">{p.nombre}</span>
                  <span className="shrink-0 rounded bg-[var(--purple)]/10 px-1.5 text-[10px] font-extrabold uppercase text-[var(--purple)]">Cliente</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); const c = PERSONAS.find((x) => x.tipo === 'Compita' && x.nombre.startsWith(p.compita ?? '')); if (c) abrir(c.id) }}
                  className="flex items-center gap-1.5 rounded-full py-0.5 pr-2 text-sm text-[var(--text-mid)] hover:bg-[var(--warm-gray)]"
                  title={`Ver ficha de ${p.compita}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-[10px] font-extrabold text-white">{p.compita?.[0]}</span>
                  <span className="truncate underline decoration-[var(--border-muted)] underline-offset-2">{p.compita}</span>
                  <span className="text-[10px] font-extrabold uppercase text-[var(--orange-dark)]">Compita ›</span>
                </button>
                  <ContactoCompita p={PERSONAS.find((x) => x.tipo === 'Compita' && x.nombre.startsWith(p.compita ?? '')) ?? p} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded-full bg-[var(--yellow)] px-2 py-0.5 text-xs font-bold">{p.etapa}</span>
                <div className="mt-1 text-xs text-[var(--text-light)]">{p.linea[0].cuando}</div>
              </div>
              <span className="text-xl text-[var(--text-light)]">›</span>
            </div>
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-[var(--text-light)]">Nadie en esta etapa</li>}
      </ul>
    </section>
  )
}


// Botón "?" que explica en palabras simples qué significa una columna o un filtro (al pasar el cursor o al tocarlo).
function Info({ texto, lado = 'centro' }: { texto: string; lado?: 'izq' | 'centro' | 'der' }) {
  const [abierto, setAbierto] = useState(false)
  const pos = lado === 'izq' ? 'left-0' : lado === 'der' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <span className="group relative inline-flex" onMouseLeave={() => setAbierto(false)}>
      <button type="button" aria-label="¿Qué significa?" aria-expanded={abierto} onClick={(e) => { e.stopPropagation(); setAbierto(!abierto) }} className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--text-light)] text-[11px] font-extrabold normal-case text-[var(--text-mid)] hover:bg-[var(--purple)] hover:text-white">?</button>
      <span role="tooltip" className={`pointer-events-none absolute top-full z-30 mt-1 w-56 rounded-xl bg-[var(--purple-dark)] p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg ${pos} ${abierto ? 'block' : 'hidden group-hover:block'}`}>{texto}</span>
    </span>
  )
}

const VISTAS: { id: string; t: string; ayuda?: string; f: (s: StatsCompita) => boolean }[] = [
  { id: 'todas', t: 'Todos', f: () => true },
  { id: 'disponibles', t: 'Disponibles', f: (s) => s.estado === 'Disponible' },
  { id: 'cupo', t: 'Con cupo', f: (s) => s.estado === 'Con cupo' },
  { id: 'sinrespuesta', t: 'Sin respuesta 24h', ayuda: 'Compitas activos que llevan 24 horas o más sin responder ni usar Telegram.', f: (s) => s.estado !== 'En pausa' && s.estado !== 'Nuevo' && s.inactivoH >= 24 },
  { id: 'cancel', t: 'Cancelaciones tardías', ayuda: 'Compitas que en los últimos 30 días cancelaron con menos de 24 horas de aviso. Las justificadas (enfermedad, emergencia) no cuentan.', f: (s) => s.tardias >= 1 },
  { id: 'pausa', t: 'En pausa', f: (s) => s.estado === 'En pausa' },
  { id: 'nuevas', t: 'Nuevos sin verificar', ayuda: 'Compitas que ya se registraron y que el equipo aún no ha verificado.', f: (s) => s.estado === 'Nuevo' },
]
function urgCompita(s: StatsCompita): Urgencia {
  if (s.estado === 'Nuevo' || s.estado === 'En pausa') return 'verde'
  if (s.respuesta < 50 || (s.rating > 0 && s.rating < 4) || s.inactivoH > 72 || s.tardias >= 3) return 'rojo'
  if (s.respuesta < 75 || s.inactivoH > 24 || s.tardias >= 2) return 'amarillo'
  return 'verde'
}
const ORD_URG: Record<Urgencia, number> = { rojo: 0, amarillo: 1, verde: 2 }
const COLUMNAS: { id: string; t: string; ayuda?: string; clase: string; v: (p: Persona) => number | string }[] = [
  { id: 'nombre', t: 'Nombre', clase: '', v: (p) => p.nombre },
  { id: 'zona', ayuda: 'Zona de la ciudad donde atiende.', t: 'Zona', clase: 'hidden @2xl:table-cell', v: (p) => p.zona },
  { id: 'estado', ayuda: 'Si puede recibir solicitudes nuevas (Disponible, Con cupo), si está en pausa o si es nuevo y falta verificarlo.', t: 'Estado', clase: 'hidden @lg:table-cell', v: (p) => p.stats!.estado },
  { id: 'activos', ayuda: 'Familias que atiende ahora.', t: 'Clientes', clase: 'hidden @4xl:table-cell', v: (p) => p.stats!.activos },
  { id: 'visitas', ayuda: 'Visitas que hizo en el último mes.', t: 'Visitas mes', clase: 'hidden @4xl:table-cell', v: (p) => p.stats!.visitas },
  { id: 'rating', ayuda: 'Calificación promedio que le dan las familias, de 1 a 5. Menos de 4 se marca en rojo.', t: '★', clase: '', v: (p) => p.stats!.rating },
  { id: 'respuesta', ayuda: 'Porcentaje de solicitudes que respondió. Menos de 75% se marca en amarillo y menos de 50% en rojo.', t: 'Respuesta', clase: 'hidden @lg:table-cell', v: (p) => p.stats!.respuesta },
  { id: 'canc', ayuda: 'Cancelaciones del compita en los últimos 30 días. Entre paréntesis, las tardías (con menos de 24 horas de aviso). Con 2 tardías se abre una revisión; con 3 o más se pausan sus solicitudes nuevas.', t: 'Cancelaciones', clase: 'hidden @2xl:table-cell', v: (p) => p.stats!.tardias * 100 + p.stats!.canc },
  { id: 'inactivo', ayuda: 'Tiempo desde la última vez que respondió o usó Telegram. Más de 24 horas se marca en amarillo y más de 72 en rojo.', t: 'Sin actividad', clase: 'hidden @4xl:table-cell', v: (p) => p.stats!.inactivoH },
]
const POR_PAG = 25

function Personas({ abrir }: { abrir: (id: string) => void }) {
  const embebido = useEmbedded()
  // Dentro del recorrido el recuadro es angosto: solo nombre, calificación y respuesta (los saltos por ancho de ventana no sirven ahí).
  const cc = (id: string) => (embebido ? (['nombre', 'rating', 'respuesta'].includes(id) ? '' : 'hidden') : COLUMNAS.find((c) => c.id === id)!.clase)
  const [q, setQ] = useUrlState('q', '')
  const [vista, setVista] = useUrlState('vista', 'todas')
  const [orden, setOrden] = useUrlState('orden', 'urgencia')
  const [dir, setDir] = useUrlState('dir', 'asc')
  const [pag, setPag] = useUrlState('pag', '1')

  const compitas = useMemo(() => PERSONAS.filter((p) => p.tipo === 'Compita' && p.stats), [])
  const buscadas = useMemo(() => compitas.filter((p) => (p.nombre + p.zona).toLowerCase().includes(q.toLowerCase())), [compitas, q])
  const filtradas = useMemo(() => {
    const v = VISTAS.find((x) => x.id === vista) ?? VISTAS[0]
    const l = buscadas.filter((p) => v.f(p.stats!))
    const col = COLUMNAS.find((c) => c.id === orden)
    const sgn = dir === 'desc' ? -1 : 1
    return [...l].sort((a, b) => {
      if (!col) return (ORD_URG[urgCompita(a.stats!)] - ORD_URG[urgCompita(b.stats!)]) || b.stats!.inactivoH - a.stats!.inactivoH
      const x = col.v(a), y = col.v(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sgn
    })
  }, [buscadas, vista, orden, dir])

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAG))
  const actual = Math.min(Math.max(1, Number(pag) || 1), paginas)
  const fila = filtradas.slice((actual - 1) * POR_PAG, actual * POR_PAG)

  const ordenar = (id: string) => {
    if (orden === id) setDir(dir === 'asc' ? 'desc' : 'asc')
    else { setOrden(id); setDir('asc') }
    setPag('1')
  }

  return (
    <section>
      <h1 className="text-2xl font-extrabold">Compitas</h1>
      <p className="text-[var(--text-mid)]">{compitas.length} en total. Por defecto, primero los que necesitan atención.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {VISTAS.map((v) => {
          const n = buscadas.filter((p) => v.f(p.stats!)).length
          return (
            <span key={v.id} className="inline-flex items-center gap-1">
            <button onClick={() => { setVista(v.id); setPag('1') }} aria-pressed={vista === v.id} className={`min-h-10 rounded-full px-3 text-sm font-bold ${vista === v.id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>
              {v.t} <span className="opacity-70">{n}</span>
            </button>
            {v.ayuda && <Info texto={v.ayuda} lado={v.id === 'nuevas' ? 'der' : 'izq'} />}
            </span>
          )
        })}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPag('1') }} placeholder="Buscar por nombre o zona" className="mt-3 min-h-12 w-full rounded-xl border border-[var(--border-muted)] bg-white px-3 text-base sm:w-80" />

      <div className="@container mt-3 rounded-2xl border border-[var(--border-muted)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--warm-gray)] text-xs uppercase tracking-wider text-[var(--text-mid)] [&_th:first-child]:rounded-tl-2xl [&_th:last-child]:rounded-tr-2xl">
            <tr>
              {COLUMNAS.map((c, i) => (
                <th key={c.id} className={`p-0 ${cc(c.id)}`}>
                  <div className="flex items-center gap-1 px-3">
                    <button onClick={() => ordenar(c.id)} className="flex min-h-10 min-w-0 items-center gap-1 text-left font-extrabold uppercase">
                      {c.t}{orden === c.id ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                    {c.ayuda && <span><Info texto={c.ayuda} lado={i <= 1 ? 'izq' : i >= COLUMNAS.length - 3 ? 'der' : 'centro'} /></span>}
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-muted)]">
            {fila.map((p) => {
              const s = p.stats!
              return (
                <tr key={p.id} onClick={() => abrir(p.id)} className="cursor-pointer active:bg-[var(--warm-gray)] hover:bg-[var(--warm-white)]">
                  <td className="w-full max-w-0 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${URG_ESTILO[urgCompita(s)]}`}>{p.nombre[0]}</span>
                      <span className="min-w-[8rem] flex-1"><span className="block truncate font-bold">{p.nombre}</span><span className={`block truncate text-xs text-[var(--text-mid)] ${embebido ? '' : '@2xl:hidden'}`}>{p.zona} · {s.estado}{s.tardias > 0 && <b className="text-[#92400E]"> · {s.tardias} cancelación{s.tardias > 1 ? 'es' : ''} tardía{s.tardias > 1 ? 's' : ''}</b>}</span></span>
                      <span className="ml-auto"><ContactoCompita p={p} /></span>
                    </div>
                  </td>
                  <td className={`px-3 ${cc('zona')}`}>{p.zona}</td>
                  <td className={`px-3 ${cc('estado')}`}>{s.estado}</td>
                  <td className={`px-3 ${cc('activos')}`}>{s.activos}</td>
                  <td className={`px-3 ${cc('visitas')}`}>{s.visitas}</td>
                  <td className="px-3">{s.rating ? s.rating.toFixed(1) : '·'}</td>
                  <td className={`px-3 ${cc('respuesta')}`}>{s.respuesta ? `${s.respuesta}%` : '·'}</td>
                  <td className={`px-3 ${cc('canc')}`}>
                    {s.canc === 0 ? <span className="text-[var(--text-light)]">·</span> : <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${s.tardias >= 3 ? 'bg-[#D93A3A] text-white' : s.tardias >= 2 ? 'bg-[#F5B800] text-[var(--purple-dark)]' : 'bg-[var(--warm-gray)] text-[var(--text-mid)]'}`}>{s.canc}{s.tardias > 0 ? ` (${s.tardias} tardía${s.tardias > 1 ? 's' : ''})` : ''}</span>}
                  </td>
                  <td className={`px-3 ${cc('inactivo')}`}>{s.inactivoH < 1 ? 'ahora' : `${s.inactivoH} h`}</td>
                  <td className="px-2 text-lg text-[var(--text-light)]">›</td>
                </tr>
              )
            })}
            {!fila.length && <tr><td colSpan={10} className="p-6 text-center text-[var(--text-light)]">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-[var(--text-mid)]">{filtradas.length ? `${(actual - 1) * POR_PAG + 1} a ${Math.min(actual * POR_PAG, filtradas.length)} de ${filtradas.length}` : '0 resultados'}</span>
        <div className="flex gap-2">
          <button disabled={actual <= 1} onClick={() => setPag(String(actual - 1))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold disabled:opacity-40">‹ Anterior</button>
          <span className="flex items-center px-1 font-bold">{actual} / {paginas}</span>
          <button disabled={actual >= paginas} onClick={() => setPag(String(actual + 1))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold disabled:opacity-40">Siguiente ›</button>
        </div>
      </div>
    </section>
  )
}

// ── Visitas ──────────────────────────────────────────────────────────────────
type EstadoVisita = 'Programada' | 'En curso' | 'Terminada' | 'No se presentó' | 'Sin acceso'
type VisitaFalsa = { id: string; ts: number; estado: EstadoVisita; clienteId: string; compitaId: string; zona: string; rating: number | null }
const AHORA = new Date(2026, 10, 3, 11, 0) // martes 3 nov, 11:00 (fecha ficticia fija)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaDe = (ts: number) => new Date(AHORA.getTime() + ts * 3600_000)
const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const etiquetaFecha = (ts: number) => {
  const f = fechaDe(ts)
  const hh = `${String(f.getHours()).padStart(2, '0')}:00`
  return mismoDia(f, AHORA) ? `Hoy ${hh}` : `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]} ${hh}`
}
const COMPITAS_IDS = PERSONAS.filter((x) => x.tipo === 'Compita').map((x) => x.id)
const CLIENTES_IDS = PERSONAS.filter((x) => x.tipo === 'Cliente').map((x) => x.id)
const VISITAS: VisitaFalsa[] = Array.from({ length: 140 }, (_, i) => {
  const ts = i < 100 ? -Math.floor(azar() * 300) - 2 : Math.floor(azar() * 90) - 1
  const r = azar()
  let estado: EstadoVisita
  if (ts >= -1 && ts <= 0) estado = 'En curso'
  else if (ts > 0) estado = 'Programada'
  else estado = r < 0.08 ? 'No se presentó' : r < 0.12 ? 'Sin acceso' : 'Terminada'
  const compitaId = COMPITAS_IDS[Math.floor(azar() * COMPITAS_IDS.length)]
  const comp = PERSONAS.find((x) => x.id === compitaId)!
  const rating = estado === 'Terminada' ? Math.min(5, Math.max(2, Math.round(3.6 + azar() * 1.9))) : null
  return { id: `v${i}`, ts, estado, clienteId: CLIENTES_IDS[Math.floor(azar() * CLIENTES_IDS.length)], compitaId, zona: comp.zona, rating }
})
// Cada regla corresponde a un dato real: el cron noshow-alerta (30 min) y visitas.rating_cliente.
const motivoProblema = (v: VisitaFalsa): string | null =>
  v.estado === 'No se presentó' ? 'No inició 30 min después de su hora' : v.estado === 'Sin acceso' ? 'Llegó y nadie abrió en 30 min: cuenta como usada' : v.rating !== null && v.rating <= 3 ? `El cliente la calificó con ${v.rating} estrellas` : null
const esProblema = (v: VisitaFalsa) => motivoProblema(v) !== null
const VISTAS_VISITA: { id: string; t: string; f: (v: VisitaFalsa) => boolean; desc?: boolean }[] = [
  { id: 'hoy', t: 'Hoy', f: (v) => mismoDia(fechaDe(v.ts), AHORA) },
  { id: 'curso', t: 'En curso', f: (v) => v.estado === 'En curso' },
  { id: 'proximas', t: 'Próximas', f: (v) => v.estado === 'Programada' },
  { id: 'terminadas', t: 'Terminadas', f: (v) => v.estado === 'Terminada', desc: true },
  { id: 'problemas', t: 'Con problema', f: esProblema, desc: true },
  { id: 'todas', t: 'Todas', f: () => true, desc: true },
]
const CHIP_ESTADO: Record<EstadoVisita, string> = {
  Programada: 'bg-[var(--purple)]/10 text-[var(--purple)]',
  'En curso': 'bg-[#1f9d6b] text-white',
  Terminada: 'bg-[var(--warm-gray)] text-[var(--text-mid)]',
  'No se presentó': 'bg-[#D93A3A] text-white',
  'Sin acceso': 'bg-[#F5B800] text-[var(--purple-dark)]',
}

function Visitas({ abrir }: { abrir: (id: string) => void }) {
  const verChat = useContext(VerChatCtx)
  const puede = usePuede()
  const [vista, setVista] = useUrlState('vv', 'hoy')
  const [pag, setPag] = useUrlState('pv', '1')
  const def = VISTAS_VISITA.find((x) => x.id === vista) ?? VISTAS_VISITA[0]
  const lista = useMemo(() => VISITAS.filter(def.f).sort((a, b) => (def.desc ? b.ts - a.ts : a.ts - b.ts)), [def])
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAG))
  const actual = Math.min(Math.max(1, Number(pag) || 1), paginas)
  const fila = lista.slice((actual - 1) * POR_PAG, actual * POR_PAG)
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Visitas</h1>
      <p className="text-[var(--text-mid)]">Hoy es martes 3 de noviembre. Lo cerrado se consulta en Terminadas. &quot;Con problema&quot; muestra el motivo de cada fila.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <InfoBoton que="Filtrar visitas" texto="Elige qué visitas ver: lo de hoy, lo que tiene problema o lo ya terminado. El número es cuántas hay. No cambia nada." alineado="izquierda" />
        {VISTAS_VISITA.map((v) => (
          <button key={v.id} onClick={() => { setVista(v.id); setPag('1') }} aria-pressed={vista === v.id} className={`min-h-10 rounded-full px-3 text-sm font-bold ${vista === v.id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>
            {v.t} <span className="opacity-70">{VISITAS.filter(v.f).length}</span>
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {fila.map((v) => {
          const cli = PERSONAS.find((x) => x.id === v.clienteId)!
          const cmp = PERSONAS.find((x) => x.id === v.compitaId)!
          return (
            <li key={v.id} className="flex items-center gap-3 px-3 py-2">
              <div className="w-24 shrink-0 text-sm font-bold sm:w-28">{etiquetaFecha(v.ts)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <button onClick={() => abrir(cli.id)} className="flex min-w-0 items-center gap-1 font-extrabold hover:underline">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--purple)]" />
                    <span className="truncate">{cli.nombre}</span>
                    <span className="rounded bg-[var(--purple)]/10 px-1 text-[10px] font-extrabold uppercase text-[var(--purple)]">Cliente</span>
                  </button>
                  <button onClick={() => abrir(cmp.id)} className="flex min-w-0 items-center gap-1 font-bold text-[var(--text-mid)] hover:underline">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--orange)]" />
                    <span className="truncate">{cmp.nombre}</span>
                    <span className="rounded bg-[var(--orange)]/15 px-1 text-[10px] font-extrabold uppercase text-[var(--orange-dark)]">Compita</span>
                  </button>
                  <ContactoCompita p={cmp} />
                </div>
                {motivoProblema(v) ? <div className="truncate text-xs font-bold text-[#D93A3A]">{motivoProblema(v)}</div> : <div className="truncate text-xs text-[var(--text-light)]">{v.zona}</div>}
              </div>
              {puede('chats') && <button onClick={() => verChat(cli.id, cmp.id)} aria-label={`Ver el chat de ${cli.nombre} y ${cmp.nombre}`} className="min-h-10 shrink-0 rounded-xl border border-[var(--border-muted)] bg-white px-3 text-sm font-bold text-[var(--text-mid)]">Chat</button>}
              <div className="shrink-0 text-right">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP_ESTADO[v.estado]}`}>{v.estado}</span>
                {v.rating !== null && <div className={`mt-1 text-xs font-bold ${v.rating <= 3 ? 'text-[#D93A3A]' : 'text-[var(--text-mid)]'}`}>{'★'.repeat(v.rating)}</div>}
              </div>
            </li>
          )
        })}
        {!fila.length && <li className="p-6 text-center text-[var(--text-light)]">No hay visitas en esta vista</li>}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-[var(--text-mid)]">{lista.length ? `${(actual - 1) * POR_PAG + 1} a ${Math.min(actual * POR_PAG, lista.length)} de ${lista.length}` : '0 resultados'}</span>
        <div className="flex gap-2">
          <button disabled={actual <= 1} onClick={() => setPag(String(actual - 1))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold disabled:opacity-40">‹ Anterior</button>
          <span className="flex items-center px-1 font-bold">{actual} / {paginas}</span>
          <button disabled={actual >= paginas} onClick={() => setPag(String(actual + 1))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold disabled:opacity-40">Siguiente ›</button>
        </div>
      </div>
    </section>
  )
}

// ── Más ──────────────────────────────────────────────────────────────────────
type Madurez = 'existe' | 'base'
const HUB: { id: string; i: string; t: string; d: string; m: Madurez; sub: boolean }[] = [
  { id: 'resenas', i: '', t: 'Reseñas por aprobar', d: 'Aprueba u oculta lo que el cliente escribe antes de que se vea en el perfil del compita.', m: 'existe', sub: true },
  { id: 'postulaciones', i: '', t: 'Postulaciones y origen', d: 'Quién se postuló, desde qué página o campaña llegó y si calificó.', m: 'existe', sub: true },
  { id: 'pagos', i: '', t: 'Pagos', d: 'Pagos registrados, con la opción de anular uno si hubo un error.', m: 'existe', sub: true },
  { id: 'avisos', i: '', t: 'Avisos enviados', d: 'Qué se le mandó a cada persona, por qué canal y si llegó. Aquí se reintentan los fallidos.', m: 'base', sub: true },
  { id: 'cobertura', i: '', t: 'Cobertura y demanda', d: 'Por zona: compitas disponibles frente a solicitudes del mes. Dónde falta reclutar.', m: 'existe', sub: true },
  { id: 'umbrales', i: '', t: 'Ajustes del semáforo', d: 'Cuántas horas son normales en cada etapa antes de pasar a amarillo y rojo.', m: 'base', sub: true },
  { id: 'equipo', i: '', t: 'Equipo y permisos', d: 'Quién entra al panel, con qué rol y qué puede hacer cada uno.', m: 'base', sub: true },
  { id: 'ajustes', i: '', t: 'Ajustes', d: 'Precios, plazos, topes y umbrales. Se cambian aquí, con registro de quién y cuándo; no hay que tocar el código.', m: 'base', sub: true },
  { id: 'actividad', i: '', t: 'Actividad', d: 'Todo lo que pasó en el sistema, en orden. Aquí no suena nada: se consulta cuando hace falta.', m: 'base', sub: true },
  { id: 'limites', i: '', t: 'Límites y esperas', d: 'Lo que el sistema frena a propósito (plazos entre envíos, máximos) y por qué. Para responder "¿por qué no deja hacerlo otra vez?".', m: 'base', sub: true },
  { id: 'manual', i: '', t: 'Manual', d: 'Cómo funciona todo el sistema y qué hacer en cada situación. Se busca con tus palabras.', m: 'base', sub: true },
  { id: 'registro', i: '', t: 'Registro de actividad', d: 'Quién del equipo vio un teléfono o dato sensible, cuándo y por qué.', m: 'base', sub: true },
  { id: 'estado', i: '', t: 'Estado del sistema', d: 'Procesos automáticos, avisos fallidos y salud de Telegram, correo y videollamadas.', m: 'base', sub: true },
]

function Volver({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="mb-3 min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-3 font-bold">‹ Volver a Más</button>
}
function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">{children}</ul>
}

function VistaResenas() {
  const datos = [
    { id: 'r1', cli: 'Carolina Pérez', cmp: 'María Fuentes', e: 5, t: 'Mi mamá quedó encantada, muy puntual y cariñosa.' },
    { id: 'r2', cli: 'Luis Andrade', cmp: 'Rosa Linares', e: 2, t: 'Llegó tarde y casi no conversó con mi papá.' },
    { id: 'r3', cli: 'Marta Salcedo', cmp: 'María Fuentes', e: 5, t: 'Excelente. La recomiendo.' },
    { id: 'r4', cli: 'Jorge Rivas', cmp: 'Daniela Torres', e: 4, t: 'Todo bien, solo pediría más fotos de la visita.' },
  ]
  const [dec, setDec] = useState<Record<string, string>>({})
  return (
    <>
      <p className="text-[var(--text-mid)]">Una reseña no se muestra al público hasta que la apruebas (columna `publicada`).</p>
      <Lista>
        {datos.map((r) => (
          <li key={r.id} className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm"><b>{r.cli}</b><span className="text-[var(--text-light)]">sobre</span><b>{r.cmp}</b><span className={r.e <= 2 ? 'font-bold text-[#D93A3A]' : 'text-[var(--text-mid)]'}>{'★'.repeat(r.e)}</span></div>
            <p className="mt-1 text-[var(--text-mid)]">{r.t}</p>
            {dec[r.id] ? <div className="mt-2 font-bold text-green-700">{dec[r.id]}</div> : (
              <div className="mt-2 flex gap-2">
                <button onClick={() => setDec((d) => ({ ...d, [r.id]: 'Aprobada ✓ Ya se ve en el perfil' }))} className="min-h-10 rounded-xl bg-[var(--orange)] px-4 font-extrabold text-white">Aprobar</button>
                <InfoBoton que="Aprobar" texto="Publica la reseña en el perfil del compita y cuenta en su calificación." alineado="izquierda" />
                <button onClick={() => setDec((d) => ({ ...d, [r.id]: 'Oculta ✓' }))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold">Ocultar</button>
                <InfoBoton que="Ocultar" texto="La reseña no se publica ni cuenta en la calificación. El cliente no recibe ningún aviso." alineado="izquierda" />
              </div>
            )}
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaPostulaciones() {
  const datos = [
    { n: 'Ana Rodríguez', tipo: 'Familia', c: 'Pendiente', f: 'home', camp: 'meta_adultos_mayores', u: 'Miami', h: 'hace 1 h' },
    { n: 'Pedro Molina', tipo: 'Familia', c: 'Calificada', f: 'home', camp: 'meta_adultos_mayores', u: 'Madrid', h: 'hace 3 h' },
    { n: 'Yoleida Cruz', tipo: 'Compita', c: 'Pendiente', f: 'se_compita', camp: 'flyer_universidad', u: 'Caracas', h: 'hace 5 h' },
    { n: 'Luisa Pérez', tipo: 'Compita', c: 'Calificada', f: 'se_compita', camp: 'flyer_universidad', u: 'Caracas', h: 'ayer' },
    { n: 'Carlos Díaz', tipo: 'Familia', c: 'Repetida', f: 'home', camp: 'meta_adultos_mayores', u: 'Bogotá', h: 'ayer' },
    { n: 'Sofía Mena', tipo: 'Familia', c: 'No calificada', f: 'home', camp: 'directo', u: 'Panamá', h: 'ayer' },
  ]
  const porCamp = datos.reduce<Record<string, number>>((a, d) => ({ ...a, [d.camp]: (a[d.camp] ?? 0) + 1 }), {})
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada postulación guarda su fuente y campaña (utm). Así sabes qué anuncio trae gente que sí califica.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(porCamp).map(([k, n]) => <span key={k} className="rounded-full border border-[var(--border-muted)] bg-white px-3 py-1 text-sm font-bold">{k} <span className="opacity-70">{n}</span></span>)}
      </div>
      <Lista>
        {datos.map((d, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><b className="truncate">{d.n}</b><span className={`rounded px-1 text-[10px] font-extrabold uppercase ${d.tipo === 'Compita' ? 'bg-[var(--orange)]/15 text-[var(--orange-dark)]' : 'bg-[var(--purple)]/10 text-[var(--purple)]'}`}>{d.tipo}</span></div>
              <div className="truncate text-xs text-[var(--text-mid)]">{d.u} · {d.f} · {d.camp} · {d.h}</div>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--warm-gray)] px-2 py-0.5 text-xs font-bold">{d.c}</span>
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaPagos() {
  const datos = [
    { id: 'g1', c: 'Carolina Pérez', plan: 'Compañía', m: '$75', f: 'hoy', ref: 'COMPAZ-4F7K2Q' },
    { id: 'g2', c: 'Marta Salcedo', plan: 'Compañía Plus', m: '$140', f: 'lun 2 nov', ref: 'COMPAZ-9X2LMA' },
    { id: 'g3', c: 'Jorge Rivas', plan: 'Compañía', m: '$75', f: 'dom 1 nov', ref: 'COMPAZ-7TQ8RE' },
    { id: 'g4', c: 'Luis Andrade', plan: 'Compañía', m: '$75', f: 'sáb 31 oct', ref: 'COMPAZ-2BD5NW' },
  ]
  const [anulados, setAnulados] = useState<Record<string, boolean>>({})
  return (
    <>
      <p className="text-[var(--text-mid)]">Anular un pago libera las visitas que no se cobraron (función `anularPago`).</p>
      <Lista>
        {datos.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{g.c} <span className="text-sm font-normal text-[var(--text-mid)]">· {g.plan} · {g.m}</span></div>
              <div className="text-xs text-[var(--text-light)]">{g.f} · {g.ref}</div>
            </div>
            {anulados[g.id] ? <span className="font-bold text-[#D93A3A]">Anulado ✓</span> : (
              <span className="flex shrink-0 items-center"><button onClick={() => setAnulados((a) => ({ ...a, [g.id]: true }))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-3 text-sm font-bold">Anular pago</button><InfoBoton que="Anular pago" texto="Deja el pago sin efecto: las visitas que había activado se descuentan. Úsalo solo si hubo un error. Queda anotado quién lo anuló." alineado="izquierda" /></span>
            )}
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaAvisos() {
  const datos = [
    { id: 'a1', cuando: 'hoy 10:05', canal: 'Telegram', para: 'Rosa Linares', rol: 'Compita', tipo: 'Nueva solicitud', ok: false, motivo: 'Telegram no entregó: el compita bloqueó el bot', accion: 'Avisarle por correo', hecho: 'Correo enviado ✓' },
    { id: 'a2', cuando: 'hoy 09:41', canal: 'Correo', para: 'Carolina Pérez', rol: 'Cliente', tipo: 'Pago recibido', ok: true, motivo: '' },
    { id: 'a3', cuando: 'hoy 09:30', canal: 'Telegram', para: 'María Fuentes', rol: 'Compita', tipo: 'Entrevista en 1 hora', ok: true, motivo: '' },
    { id: 'a4', cuando: 'hoy 08:50', canal: 'Correo', para: 'Luis Andrade', rol: 'Cliente', tipo: '¿Contratas a Rosa?', ok: false, motivo: 'El correo rebotó (buzón lleno)', accion: 'Reintentar', hecho: 'Reenviado ✓' },
    { id: 'a5', cuando: 'ayer 18:20', canal: 'Telegram', para: 'Daniela Torres', rol: 'Compita', tipo: 'Nueva solicitud', ok: true, motivo: '' },
    { id: 'a6', cuando: 'ayer 16:02', canal: 'Correo', para: 'Ana Gómez', rol: 'Cliente', tipo: 'Solicitud enviada', ok: true, motivo: '' },
  ]
  const [vista, setVista] = useUrlState('av', 'todos')
  const [rein, setRein] = useState<Record<string, boolean>>({})
  const lista = datos.filter((d) => vista === 'todos' || !d.ok)
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada aviso queda guardado con su resultado. Si falla, se reintenta cuando el fallo es pasajero y se avisa por otro canal cuando no tiene arreglo, por ejemplo si el compita bloqueó el bot.</p>
      <div className="mt-3 flex items-center gap-2">
        <InfoBoton que="Filtrar avisos" texto="Todos muestra cada aviso enviado. Fallidos muestra solo los que no llegaron, para reintentarlos." alineado="izquierda" />
        {[['todos', 'Todos', datos.length], ['fallidos', 'Fallidos', datos.filter((d) => !d.ok).length]].map(([id, t, n]) => (
          <button key={id as string} onClick={() => setVista(id as string)} aria-pressed={vista === id} className={`min-h-10 rounded-full px-3 text-sm font-bold ${vista === id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>{t} <span className="opacity-70">{n}</span></button>
        ))}
      </div>
      <Lista>
        {lista.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm"><b>{d.para}</b><span className={`rounded px-1 text-[10px] font-extrabold uppercase ${d.rol === 'Compita' ? 'bg-[var(--orange)]/15 text-[var(--orange-dark)]' : 'bg-[var(--purple)]/10 text-[var(--purple)]'}`}>{d.rol}</span><span className="text-xs text-[var(--text-light)]">{d.cuando}</span></div>
              <div className="truncate text-sm text-[var(--text-mid)]">{d.tipo}</div>
              {!d.ok && <div className="text-xs font-bold text-[#D93A3A]">{d.motivo}</div>}
            </div>
            {d.ok ? <span className="shrink-0 text-sm font-bold text-green-700">Entregado</span> : rein[d.id] ? <span className="shrink-0 text-sm font-bold text-green-700">{d.hecho}</span> : (
              <span className="flex shrink-0 items-center"><button onClick={() => setRein((r) => ({ ...r, [d.id]: true }))} className="min-h-10 rounded-xl bg-[var(--orange)] px-3 text-sm font-extrabold text-white">{d.accion}</button><InfoBoton que={d.accion ?? "Reintentar"} texto={`Hace "${d.accion}" para este aviso por el canal que sí funcione. Si vuelve a fallar, la tarea sigue abierta con el motivo.`} alineado="izquierda" /></span>
            )}
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaCobertura() {
  const demanda: Record<string, number> = { Chacao: 14, Altamira: 9, 'Los Palos Grandes': 12, 'El Rosal': 4, 'La Castellana': 7, 'Sabana Grande': 3, 'Los Chaguaramos': 10, 'El Paraíso': 2 }
  const filas = ZONAS.map((z) => {
    const comp = GENERADAS.filter((c) => c.zona === z && (c.stats!.estado === 'Disponible' || c.stats!.estado === 'Con cupo')).length
    const dem = demanda[z] ?? 0
    return { z, comp, dem, falta: comp === 0 || dem / Math.max(comp, 1) >= 2 }
  }).sort((a, b) => Number(b.falta) - Number(a.falta) || b.dem - a.dem)
  return (
    <>
      <p className="text-[var(--text-mid)]">Compitas activos por zona contra solicitudes del mes. En rojo, donde la demanda duplica a la oferta: ahí conviene reclutar.</p>
      <Lista>
        {filas.map((f) => (
          <li key={f.z} className="px-3 py-2">
            <div className="flex items-center justify-between"><b>{f.z}</b>{f.falta && <span className="rounded-full bg-[#D93A3A] px-2 py-0.5 text-xs font-bold text-white">Faltan compitas</span>}</div>
            <div className="mt-1 text-sm text-[var(--text-mid)]">{f.comp} compitas activos · {f.dem} solicitudes este mes</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--warm-gray)]"><div className={`h-full ${f.falta ? 'bg-[#D93A3A]' : 'bg-[#1f9d6b]'}`} style={{ width: `${Math.min(100, (f.dem / 14) * 100)}%` }} /></div>
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaUmbrales() {
  const [v, setV] = useState<Record<string, [number, number]>>(() => ({ ...UMBRALES }))
  const [ok, setOk] = useState(false)
  return (
    <>
      <p className="text-[var(--text-mid)]">Horas en una etapa antes de pasar a amarillo y a rojo.</p>
      <Lista>
        {ETAPAS.map((e) => (
          <li key={e} className="flex items-center gap-3 px-3 py-2">
            <b className="w-28">{e}</b>
            {[0, 1].map((k) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <span className={`h-3 w-3 rounded-full ${k === 0 ? 'bg-[#F5B800]' : 'bg-[#D93A3A]'}`} />
                <input type="number" min={0} value={v[e][k]} onChange={(ev) => { setOk(false); setV((o) => ({ ...o, [e]: k === 0 ? [Number(ev.target.value), o[e][1]] : [o[e][0], Number(ev.target.value)] })) }} className="w-16 rounded-lg border border-[var(--border-muted)] p-1.5 text-base" />h
              </label>
            ))}
          </li>
        ))}
      </Lista>
      <div className="mt-3 flex items-center gap-1"><button onClick={() => setOk(true)} className="min-h-12 rounded-xl bg-[var(--orange)] px-5 font-extrabold text-white">Guardar ajustes</button><InfoBoton que="Guardar ajustes" texto="Guarda cuántas horas son normales en cada etapa. Desde ahora el semáforo usa estos valores; no cambia nada ya registrado." alineado="izquierda" /></div>
      {ok && <span className="ml-3 font-bold text-green-700">Guardado ✓</span>}
    </>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return <li className="flex items-center justify-between gap-3 px-3 py-3"><span className="text-base">{t}</span><b className="shrink-0 text-base">{v}</b></li>
}

type Ajuste = { id: string; t: string; v: string; unidad?: string; texto?: boolean; usa: string[]; min?: number; max?: number }
const AJUSTES: { t: string; nota?: string; filas: Ajuste[] }[] = [
  { t: 'Precios', filas: [
    { id: 'hora', t: 'Hora de servicio', v: '22', unidad: '$', usa: ['Página de pago', 'Agendar otra visita', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página', 'Precio tachado de los planes'], min: 1, max: 500 },
    { id: 'mandado', t: 'Mandado (tarifa plana, máximo 1 hora)', v: '22', unidad: '$', usa: ['Formulario de mandado', 'Aviso al compita', 'Correos de pago', 'Asistente de la página'], min: 1, max: 500 },
    { id: 'p1', t: 'Plan Compañía (2 visitas de 2 h)', v: '75', unidad: '$', usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'], min: 1, max: 5000 },
    { id: 'p2', t: 'Plan Compañía Plus (4 visitas de 2 h)', v: '140', unidad: '$', usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'], min: 1, max: 5000 },
  ] },
  { t: 'Plazos de las citas', filas: [
    { id: 'cancel', t: 'Cancelación gratuita, horas antes', v: '24', unidad: 'h', usa: ['Portal del cliente (cambiar o cancelar)', 'Términos que acepta el cliente', 'Reglas de "cuenta como usada"', 'Avisos al compita'], min: 1, max: 168 },
    { id: 'espera', t: 'Espera si nadie abre', v: '30', unidad: 'min', usa: ['Cuenta atrás del cliente', 'Aviso al compita', 'Cierre automático', 'Términos que acepta el cliente'], min: 10, max: 120 },
    { id: 'c1', t: 'Primer contacto si nadie abre', v: '5', unidad: 'min', usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'], min: 1, max: 60 },
    { id: 'c2', t: 'Segundo contacto si nadie abre', v: '15', unidad: 'min', usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'], min: 2, max: 90 },
    { id: 'todo', t: '"¿Todo bien?" después de la hora de fin', v: '15', unidad: 'min', usa: ['Aviso al compita', 'Alerta al equipo si no responde'], min: 5, max: 120 },
    { id: 'espc', t: 'Cambio en el lugar sin respuesta del compita: avisar al admin tras este % del tiempo que falta para la visita', v: '25', unidad: '%', usa: ['Tarea "Cambio en el lugar" en la Bandeja'], min: 5, max: 100 },
    { id: 'espmax', t: 'Cambio en el lugar: espera máxima antes de avisar al admin', v: '6', unidad: 'h', usa: ['Tarea "Cambio en el lugar" en la Bandeja'], min: 1, max: 48 },
    { id: 'dir', t: 'Dirección exacta al compita, horas antes', v: '3', unidad: 'h', usa: ['Aviso al compita en Telegram'], min: 1, max: 24 },
  ] },
  { t: 'Cancelaciones de compitas', filas: [
    { id: 'avisoc', t: 'Aviso mínimo para que una cancelación sea a tiempo', v: '24', unidad: 'h', usa: ['Columna y filtro de Personas', 'Ficha del compita', 'Aviso al compita al cancelar'], min: 1, max: 168 },
    { id: 'revision', t: 'Cancelaciones tardías para abrir una revisión', v: '2', usa: ['Bandeja (tarea "Cancelación tardía")', 'Semáforo del compita (amarillo)'], min: 1, max: 10 },
    { id: 'pausa', t: 'Cancelaciones tardías para pausar sus solicitudes nuevas', v: '3', usa: ['Solicitudes nuevas del compita', 'Semáforo del compita (rojo)', 'Bandeja'], min: 2, max: 20 },
    { id: 'ventanac', t: 'Ventana para contar las cancelaciones', v: '30', unidad: 'días', usa: ['Columna y filtro de Personas', 'Ficha del compita'], min: 7, max: 365 },
  ] },
  { t: 'Ayuda automática', filas: [
    { id: 'intentos', t: 'Intentos del bot antes de pasar la duda a una persona', v: '2', usa: ['Menú "Tengo una duda" del compita', 'Tarea "Duda sin resolver" en la Bandeja', 'Ayuda del cliente'], min: 1, max: 5 },
  ] },
  { t: 'Llamadas', nota: 'No hay límite de cuántas veces se puede llamar: Compaz es el puente entre el cliente y el compita. Solo se limita cuánto dura cada una.', filas: [
    { id: 'llam', t: 'Duración de una llamada fuera de visita (aviso de fin)', v: '20', unidad: 'min', usa: ['Videollamadas', 'Llamadas de voz', 'Aviso de fin dentro de la sala'], min: 5, max: 60 },
    { id: 'corte', t: 'Corte automático de la llamada', v: '23', unidad: 'min', usa: ['Salas de videollamada', 'Costo de la videollamada'], min: 6, max: 70 },
    { id: 'visita', t: 'Llamada durante una visita', v: '5', unidad: 'min', usa: ['Botón "Llamar al cliente"', 'Aviso en la sala'], min: 1, max: 20 },
  ] },
  { t: 'Seguridad y datos', filas: [
    { id: 'antifraude', t: 'Texto de la advertencia antifraude (no se puede quitar, solo cambiar el texto)', v: 'Compaz nunca te pedirá por teléfono, mensaje o llamada tus datos personales, claves, códigos, depósitos ni transferencias. Los pagos se hacen solo con los datos que ves aquí, en tu portal. Si alguien te los pide por otro medio, no respondas y avísanos.', texto: true, usa: ['Pantalla de acceso', 'Tarjeta de pago', 'Ficha', 'Chat de la visita', 'Pie del portal', 'Correos', 'Telegram del compita (versión para compitas)'] },
    { id: 'detec', t: 'Detecciones de contacto antes de alertar al equipo', v: '2', usa: ['Aviso al escribir', 'Alerta en la Bandeja', 'Ficha de la persona'], min: 1, max: 10 },
    { id: 'ventana', t: 'Ventana para contar las detecciones', v: '30', unidad: 'días', usa: ['Conteo por persona'], min: 1, max: 365 },
    { id: 'foto', t: 'Borrado de fotos de llegada', v: '90', unidad: 'días', usa: ['Limpieza diaria', 'Aviso al cliente y al compita', 'Términos y /privacidad'], min: 7, max: 730 },
    { id: 'avisosdias', t: 'Retención del registro de avisos', v: '90', unidad: 'días', usa: ['Limpieza diaria'], min: 30, max: 730 },
  ] },
]

function VistaAjustes() {
  const puedeAj = usePuede()
  const soloLectura = !puedeAj('ajustes_editar')
  const inicial = () => Object.fromEntries(AJUSTES.flatMap((g) => g.filas.map((f) => [f.id, f.v])))
  const [v, setV] = useState<Record<string, string>>(inicial)
  const [guardado, setGuardado] = useState<Record<string, string> | null>(null)
  const sucio = Object.keys(v).filter((k) => v[k] !== (guardado ?? inicial())[k])
  const todas = AJUSTES.flatMap((g) => g.filas)
  const malos = sucio.filter((k) => { const f = todas.find((x) => x.id === k)!; if (f.texto) return !v[k].trim(); const n = Number(v[k]); return !Number.isFinite(n) || v[k] === '' || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max) })
  const lugares = Array.from(new Set(sucio.flatMap((k) => todas.find((x) => x.id === k)!.usa)))
  const hora = Number(v.hora) || 0
  const [acepta, setAcepta] = useState(false)
  const ahorro1 = hora * 4 - (Number(v.p1) || 0)
  const ahorro2 = hora * 8 - (Number(v.p2) || 0)
  // Un plan que sale más caro que comprar las horas sueltas no tiene sentido: se avisa y se pide confirmar.
  const incoherente = sucio.length > 0 && (ahorro1 < 0 || ahorro2 < 0)
  const campo = 'min-h-10 rounded-lg border border-[var(--border-muted)] bg-white px-2 text-base font-bold'
  return (
    <fieldset disabled={soloLectura} className="contents">
      {soloLectura && <p role="note" className="rounded-xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">No tienes permiso para cambiar los ajustes. Puedes verlos; pídele el permiso a un administrador.</p>}
      <p className="text-[var(--text-mid)]">Aquí se cambian precios, plazos y textos, y el cambio se aplica en todo el sistema a la vez: portal, página de pago, correos, Telegram, el asistente y la página web. Cada cambio queda registrado con quién lo hizo y desde cuándo vale; lo ya pagado no se altera.</p>
      {AJUSTES.map((g) => (
        <div key={g.t} className="mt-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">{g.t}</h3>
          {g.nota && <p className="mt-1 rounded-xl bg-[var(--warm-gray)] p-3 text-sm text-[var(--text-mid)]">{g.nota}</p>}
          <Lista>
            {g.filas.map((f) => (
              <li key={f.id} className="px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`aj-${f.id}`} className="min-w-[10rem] flex-1 text-base">{f.t}</label>
                  {!f.texto && <span className="flex items-center gap-1">{f.unidad === '$' && <b>$</b>}<input id={`aj-${f.id}`} inputMode="numeric" value={v[f.id]} onChange={(e) => { setAcepta(false); setV((o) => ({ ...o, [f.id]: e.target.value })) }} className={`${campo} w-20 text-right ${malos.includes(f.id) ? 'border-[#D93A3A]' : ''}`} />{f.unidad && f.unidad !== '$' && <b>{f.unidad}</b>}</span>}
                </div>
                {f.texto && <textarea id={`aj-${f.id}`} value={v[f.id]} onChange={(e) => setV((o) => ({ ...o, [f.id]: e.target.value }))} className="mt-2 min-h-24 w-full rounded-lg border border-[var(--border-muted)] p-2 text-sm" />}
                {malos.includes(f.id) && <div className="mt-1 text-xs font-bold text-[#D93A3A]">{f.texto ? 'No puede quedar vacío.' : `Debe estar entre ${f.min} y ${f.max}.`}</div>}
                <div className="mt-1 text-xs text-[var(--text-light)]">Se usa en: {f.usa.join(', ')}.</div>
              </li>
            ))}
            {g.t === 'Llamadas' && <li className="flex items-center justify-between gap-2 px-3 py-3"><span className="text-base">Veces que se puede llamar</span><b>Sin límite</b></li>}
          </Lista>
        </div>
      ))}

      <section className="mt-5 rounded-2xl border border-[var(--border-muted)] bg-white p-4">
        <h3 className="font-extrabold">Así quedarían los planes</h3>
        <p className="text-sm text-[var(--text-mid)]">Se recalcula al instante con la hora de servicio.</p>
        <ul className="mt-2 grid gap-1 text-base">
          <li>A la carta, 1 hora: <b>${hora}</b></li>
          <li>Plan Compañía: <b>${v.p1}</b> <span className="text-[var(--text-mid)]">(sin descuento serían ${hora * 4}; {ahorro1 < 0 ? <b className="text-[#D93A3A]">el plan sale ${-ahorro1} MÁS caro que las horas sueltas</b> : `el cliente ahorra $${ahorro1}`})</span></li>
          <li>Plan Compañía Plus: <b>${v.p2}</b> <span className="text-[var(--text-mid)]">(sin descuento serían ${hora * 8}; {ahorro2 < 0 ? <b className="text-[#D93A3A]">el plan sale ${-ahorro2} MÁS caro que las horas sueltas</b> : `el cliente ahorra $${ahorro2}`})</span></li>
        </ul>
      </section>

      {guardado && !sucio.length && <p className="mt-4 rounded-xl bg-[#1f9d6b]/10 p-3 font-bold text-[#146c49]">✓ Guardado y aplicado en todo el sistema.</p>}
      {sucio.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-[var(--orange)] bg-white p-4">
          <div className="font-extrabold">{sucio.length} {sucio.length === 1 ? 'cambio' : 'cambios'} sin guardar</div>
          <p className="mt-1 text-sm text-[var(--text-mid)]">Al guardar se actualiza en: {lugares.join(', ')}. Vale desde hoy y no cambia lo ya pagado.</p>
          {incoherente && (
            <label className="mt-3 flex items-start gap-3 rounded-xl border-2 border-[#D93A3A] bg-[#FEF2F2] p-3 text-sm font-bold text-[#991B1B]">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Atención: con estos precios un plan sale más caro que comprar las mismas horas sueltas. Ningún cliente lo elegiría. Marca esta casilla si es lo que quieres.</span>
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <button disabled={malos.length > 0 || (incoherente && !acepta)} onClick={() => setGuardado({ ...v })} className="min-h-12 flex-1 rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Guardar y aplicar</button>
            <InfoBoton que="Guardar y aplicar" texto="El cambio rige desde ahora en todo el sistema (precios, plazos y textos) y queda anotado quién lo hizo y cuándo. Lo ya pagado no cambia." alineado="izquierda" />
            <button onClick={() => setV(guardado ?? inicial())} className="min-h-12 rounded-xl border border-[var(--border-muted)] px-4 font-bold">Deshacer</button>
            <InfoBoton que="Deshacer" texto="Descarta lo que cambiaste y vuelve a los valores guardados. No guarda nada." alineado="izquierda" />
          </div>
        </div>
      )}
    </fieldset>
  )
}

const ADMINS = [
  { n: 'Juan', c: 'juan@micompaz.com' },
  { n: 'Ana', c: 'ana@micompaz.com' },
]
function Interruptor({ activo, onCambia, etiqueta }: { activo: boolean; onCambia: (v: boolean) => void; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onCambia(!activo)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${activo ? 'bg-[#1f9d6b]' : 'bg-[var(--border-muted)]'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${activo ? 'left-7' : 'left-1'}`} />
      <span className="sr-only">{activo ? 'Sí' : 'No'}</span>
    </button>
  )
}
function VistaEquipo() {
  const { colabs, cambiar, restablecer, invitar } = useContext(PermCtx)
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string | null>(null)
  const valido = /^\S+@\S+\.\S+$/.test(correo) && !colabs.some((c) => c.correo === correo.trim().toLowerCase())
  return (
    <>
      <p className="text-[var(--text-mid)]">Los administradores tienen acceso completo y no necesitan dar motivo. A cada colaborador le activas o desactivas permisos con un interruptor: el cambio rige al instante y queda anotado.</p>
      <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Administradores</h3>
      <Lista>{ADMINS.map((m) => <li key={m.c} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"><div><b>{m.n}</b><div className="text-sm text-[var(--text-mid)]">{m.c} · Correo de administrador</div></div><span className="rounded-full bg-[var(--purple)] px-3 py-1 text-xs font-extrabold text-white">Acceso completo</span></li>)}</Lista>

      <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Colaboradores y sus permisos</h3>
      <div role="status" aria-live="polite" className="mt-1 min-h-6 text-sm font-bold text-[#146c49]">{guardado}</div>
      {colabs.map((c) => (
        <section key={c.id} className="mt-2 rounded-2xl border border-[var(--border-muted)] bg-white p-4" aria-label={`Permisos de ${c.nombre}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><b className="text-lg">{c.nombre}</b><div className="text-sm text-[var(--text-mid)]">{c.correo} · {c.desde}</div></div>
            <span className="rounded-full bg-[var(--yellow)] px-3 py-1 text-xs font-extrabold text-[var(--purple-dark)]">Colaborador</span>
          </div>
          <ul className="mt-3 divide-y divide-[var(--border-muted)]">
            {PERMISOS_LISTA.map((pm) => (
              <li key={pm.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><div className="text-base font-bold">{pm.t}</div><div className="text-sm text-[var(--text-mid)]">{pm.d}</div></div>
                <Interruptor activo={c.permisos[pm.id]} etiqueta={`${pm.t}, ${c.nombre}`} onCambia={(v) => { cambiar(c.id, pm.id, v); setGuardado(`✓ Guardado: ${v ? 'activaste' : 'desactivaste'} "${pm.t}" para ${c.nombre}`) }} />
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-3 opacity-70"><div><div className="text-base font-bold">Gestionar el equipo y sus permisos</div><div className="text-sm text-[var(--text-mid)]">Solo los administradores pueden hacerlo.</div></div><span className="text-sm font-bold">No</span></li>
          </ul>
          <div className="mt-3 flex items-center gap-1"><button onClick={() => { restablecer(c.id); setGuardado(`✓ Los permisos de ${c.nombre} volvieron a lo recomendado`) }} className="min-h-12 flex-1 rounded-xl border border-[var(--border-muted)] font-bold text-[var(--text-mid)]">Volver a lo recomendado</button><InfoBoton que="Volver a lo recomendado" texto="Deja los permisos de este colaborador como vienen por defecto. Queda anotado en el historial del equipo." /></div>
        </section>
      ))}

      <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">Invitar a un colaborador</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={correo} onChange={(e) => { setCorreo(e.target.value); setEnviado(null) }} inputMode="email" placeholder="correo@ejemplo.com" aria-label="Correo del colaborador" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] bg-white px-3 text-base" />
        <button disabled={!valido} onClick={() => { invitar(correo.trim().toLowerCase()); setEnviado(correo.trim()); setCorreo('') }} className="min-h-12 rounded-xl bg-[var(--orange)] px-5 font-extrabold text-white disabled:opacity-40">Invitar</button>
        <InfoBoton que="Invitar" texto="Le manda un correo de acceso a esa persona como colaborador, con los permisos recomendados. Tú ajustas qué puede hacer arriba." alineado="izquierda" />
      </div>
      {enviado && <p role="status" className="mt-2 rounded-xl bg-[#1f9d6b]/10 p-3 font-bold text-[#146c49]">✓ Invitación enviada a {enviado}. Entrará como colaborador con los permisos recomendados; ajústalos arriba.</p>}
    </>
  )
}

function VistaRegistro() {
  const filas = [['hoy 10:42', 'Admin Juan', 'Vio el teléfono del contacto en el sitio', 'Nadie abre, visita de Marta'], ['hoy 09:15', 'Admin Juan', 'Vio el teléfono del cliente', 'Confirmar pago'], ['ayer 18:03', 'Admin Ana', 'Reenvió el recordatorio de la ficha', 'Ficha incompleta']]
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada vez que alguien del equipo consulta un teléfono o un dato sensible queda anotado. Protege a los clientes y al equipo.</p>
      <Lista>{[...REGISTRO_EXTRA.map((e) => [e.cuando, e.quien, e.accion, e.motivo]), ...filas].map(([c, q, a, m]) => <li key={c + a} className="px-3 py-3"><div className="text-xs text-[var(--text-light)]">{c} · {q}</div><div className="font-bold">{a}</div><div className="text-sm text-[var(--text-mid)]">Motivo: {m}</div></li>)}</Lista>
    </>
  )
}

function DudasCompitas() {
  const filas: [string, number][] = [['No sé cómo entrar', 12], ['No encuentro la dirección', 9], ['Otra duda', 8], ['Necesito cambiar la hora', 7], ['Algo no está bien', 2]]
  const total = filas.reduce((a, [, n]) => a + n, 0)
  const sinResolver = 8 // dudas de esta semana que el bot no pudo resolver y pasaron a una persona (dato de ejemplo)
  return (
    <section className="mt-5 rounded-2xl border border-[var(--border-muted)] bg-white p-4">
      <h3 className="flex items-center gap-2 font-extrabold">Dudas de los compitas esta semana <Info texto="Lo que preguntan los compitas en el botón Tengo una duda. Si un tipo domina, el problema está en el formulario o en el aviso, y conviene arreglarlo ahí en vez de responder cada vez." lado="izq" /></h3>
      <p className="text-sm text-[var(--text-mid)]">{total} dudas, {sinResolver} ({Math.round((sinResolver / total) * 100)} %) no se resolvieron con el bot y pasaron a una persona.</p>
      <ul className="mt-2 grid gap-2">
        {filas.map(([t, n]) => (
          <li key={t}><div className="flex justify-between text-sm"><span>{t}</span><b>{n} ({Math.round((n / total) * 100)} %)</b></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--warm-gray)]"><div className="h-full bg-[var(--orange)]" style={{ width: `${(n / total) * 100}%` }} /></div></li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">La duda más común es cómo entrar: conviene que el formulario de la dirección pida las indicaciones con más detalle.</p>
    </section>
  )
}


// Actividad: todo lo que pasa en el sistema, en orden. Aquí no suena nada: lo urgente llega por Telegram con un tope por hora y lo que hay que hacer está en la Bandeja.
type NivelAct = 'urgente' | 'tarea' | 'actividad'
const ACTIVIDAD: { n: NivelAct; t: string; h: string; d: number }[] = [
  { n: 'urgente', t: 'No me siento seguro: Daniela salió de una visita', h: '9:12 am', d: 0 },
  { n: 'urgente', t: 'Llamada vencida: se pasó el plazo para llamar a Yoselin por su reporte', h: '8:40 am', d: 0 },
  { n: 'tarea', t: 'Reporte de Rosa sobre un cliente: pidió que la llamen antes de mañana 4:00 pm', h: '8:05 am', d: 0 },
  { n: 'actividad', t: 'Visita terminada: Carmen con la mamá de Marta', h: '7:55 am', d: 0 },
  { n: 'actividad', t: 'Visita iniciada: Carmen con la mamá de Marta', h: '6:02 am', d: 0 },
  { n: 'tarea', t: 'Pago por confirmar: Elena Duarte, $75', h: '5:30 pm', d: 1 },
  { n: 'actividad', t: 'Entrevista confirmada: Irene con Carolina para mañana 4:00 pm', h: '3:12 pm', d: 1 },
  { n: 'actividad', t: 'Solicitud creada: Carolina pidió una entrevista a María', h: '1:44 pm', d: 1 },
  { n: 'actividad', t: 'Cancelación gratis: un cliente canceló con más de 24 horas', h: '11:20 am', d: 1 },
  { n: 'tarea', t: 'Compita sin Telegram vinculado: Beatriz no recibe avisos', h: '9:03 am', d: 1 },
  { n: 'actividad', t: 'Tarea resuelta por equipo@compaz.com: Pago de Marta', h: '4:10 pm', d: 3 },
  { n: 'actividad', t: 'Pago confirmado: Marta, plan Compañía', h: '4:09 pm', d: 3 },
]
const NIV_ACT: Record<NivelAct, { i: string; t: string }> = { urgente: { i: '', t: 'Urgente' }, tarea: { i: '', t: 'Tarea' }, actividad: { i: '', t: 'Informativo' } }
function VistaActividad() {
  const [nivel, setNivel] = useUrlState('act_nivel', '')
  const [dias, setDias] = useUrlState('act_dias', '2')
  const [q, setQ] = useUrlState('act_q', '')
  const [texto, setTexto] = useState(q)
  const lista = ACTIVIDAD.filter((a) => (!nivel || a.n === nivel) && a.d < Number(dias) && (!q || a.t.toLowerCase().includes(q.toLowerCase())))
  const chip = (on: boolean) => `min-h-12 rounded-full px-4 text-sm font-bold ${on ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InfoBoton que="Qué es Actividad" texto="Todo lo que pasó en el sistema, en orden. Aquí no suena nada: lo urgente te llega por Telegram, con un tope por hora, y lo que debes hacer está en la Bandeja." alineado="izquierda" />
        {([['', 'Todo'], ['urgente', 'Urgentes'], ['tarea', 'Tareas'], ['actividad', 'Informativo']] as const).map(([v, t]) => <button key={v} aria-pressed={nivel === v} onClick={() => setNivel(v)} className={chip(nivel === v)}>{t}</button>)}
        <InfoBoton que="Filtrar por tipo" texto="Muestra solo un tipo de actividad: urgente, tarea o informativo. Todo vuelve a mostrar todo. No cambia ni resuelve nada." alineado="izquierda" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[['1', 'Hoy'], ['2', '2 días'], ['7', '7 días'], ['30', '30 días']].map(([v, t]) => <button key={v} aria-pressed={dias === v} onClick={() => setDias(v)} className={chip(dias === v)}>{t}</button>)}
        <InfoBoton que="Filtrar por días" texto="Elige cuánto tiempo atrás quieres mirar. La actividad se conserva 90 días." alineado="izquierda" />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setQ(texto.trim()) }} className="mt-2 flex items-center gap-1">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por compita, cliente o texto" aria-label="Buscar en la actividad" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] px-3 text-base" />
        <button type="submit" className={chip(false)}>Buscar</button>
        <InfoBoton que="Buscar" texto="Filtra la lista por el texto que escribas, por ejemplo el nombre de un compita o un cliente." />
      </form>
      <ul className="mt-3 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {lista.map((a) => (
          <li key={a.t} className="flex items-baseline gap-3 px-3 py-3">
            <span aria-label={NIV_ACT[a.n].t}>{NIV_ACT[a.n].i}</span>
            <span className="min-w-0 flex-1 text-sm font-bold">{a.t}</span>
            <span className="shrink-0 text-xs text-[var(--text-light)]">{a.d === 0 ? 'hoy' : a.d === 1 ? 'ayer' : `hace ${a.d} d`} · {a.h}</span>
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-[var(--text-light)]">No hay actividad con estos filtros.</li>}
      </ul>
    </>
  )
}

// Límites y esperas: todo lo que el sistema frena a propósito y por qué. Responde "¿por qué no deja hacerlo otra vez?" sin escribirle al desarrollador.
// Las razones salen de lib/esperas.ts (el mismo catálogo que usan los mensajes reales); los valores son los de hoy.
const VALOR_LIMITE: Record<ClaveEspera, string> = {
  recordatorio_reciente: 'Un mínimo de 12 horas entre recordatorios (editable en Ajustes)', recordatorio_limite: 'Máximo 3 por paso (editable en Ajustes)',
  pago_insistencia: 'Una alerta urgente cada 30 minutos (editable en Ajustes)', solicitudes_dia: 'Máximo 5 solicitudes en 24 horas', solicitud_mismo_compita: 'Una por compita cada 24 horas',
  codigo_fallos: '5 intentos fallidos en 15 minutos', codigo_conexion: '30 intentos en 15 minutos por conexión', acceso_conexion: '10 enlaces por hora por conexión',
  acceso_correo: 'Un enlace por minuto y correo', reconexion_llamada: 'Una reconexión cada 2 minutos', ayuda_cliente: 'Un aviso por hora por cliente', eliminar_cuenta_enlace: 'Un enlace cada 10 minutos por cliente', chat_limite: '10 mensajes por hora y 50 por día por conexión',
  postulacion_conexion: '50 postulaciones por hora por conexión', postulacion_correo: 'Una por correo',
  insistir_aviso: 'Uno cada 30 minutos y 3 por aviso', enlace_llamada_equipo: 'Uno cada 5 minutos por solicitud',
}
const QUIEN_LIMITE = { compita: 'Compitas', cliente: 'Clientes y visitantes', equipo: 'Equipo' } as const
function VistaLimites() {
  const [quien, setQuien] = useUrlState('lim', '')
  const filas = (Object.keys(CATALOGO) as ClaveEspera[]).filter((k) => !quien || CATALOGO[k].quien === quien)
  const chip = (on: boolean) => `min-h-12 rounded-full px-4 text-sm font-bold ${on ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InfoBoton que="Qué son los límites y esperas" texto="Cosas que el sistema frena a propósito: plazos entre envíos, máximos y límites de seguridad. Cuando alguien se topa con una, el mensaje que ve le explica lo mismo que lees aquí." alineado="izquierda" />
        {([['', 'Todos'], ['compita', 'Compitas'], ['cliente', 'Clientes'], ['equipo', 'Equipo']] as const).map(([v, t]) => <button key={v} aria-pressed={quien === v} onClick={() => setQuien(v)} className={chip(quien === v)}>{t}</button>)}
        <InfoBoton que="Filtrar por quién la ve" texto="Muestra solo las reglas con las que se topa un tipo de persona: compitas, clientes o equipo. No cambia ninguna regla." alineado="izquierda" />
      </div>
      <ul className="mt-3 grid gap-2">
        {filas.map((k) => (
          <li key={k} className="rounded-2xl border border-[var(--border-muted)] bg-white p-3">
            <div className="flex items-start justify-between gap-2"><div className="font-extrabold">{CATALOGO[k].limita}</div><span className="shrink-0 rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-xs font-bold text-[var(--purple)]">{QUIEN_LIMITE[CATALOGO[k].quien]}</span></div>
            <div className="flex items-center justify-between gap-1">
              <div className="text-sm text-[var(--text-mid)]">{VALOR_LIMITE[k]}</div>
              <InfoBoton que="Por qué existe esta regla" texto={CATALOGO[k].porQue} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

// Manual del equipo: se organiza por PREGUNTAS ("¿qué hago cuando...?"). El contenido sale de lib/manual.ts, el mismo módulo del sistema real:
// lo escrito a mano más lo automático (permisos y límites), que nunca queda viejo. Búsqueda, sección y pregunta abierta viven en la URL.
const PANTALLA_A_RUTA: Record<string, { tab: string; mas?: string }> = {
  bandeja: { tab: 'bandeja' }, seguimiento: { tab: 'seguimiento' }, personas: { tab: 'personas' }, visitas: { tab: 'visitas' },
}
function VistaManual() {
  const router = useRouter(); const sp = useSearchParams()
  const rol = useContext(RolCtx); const puede = usePuede()
  const [q, setQ] = useUrlState('man_q', ''); const [sec, setSec] = useUrlState('man_sec', ''); const [abierta, setAbierta] = useUrlState('man_abierta', '')
  const [texto, setTexto] = useState(q)
  const permisos = Object.fromEntries(PERMISOS_MANUAL.map((p) => [p, puede(p as Permiso)])) as Record<string, boolean>
  const lista = buscarEnManual(q).filter((e) => !sec || e.seccion === sec)
  const chip = (on: boolean) => `min-h-12 rounded-full px-4 text-sm font-bold ${on ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`
  const irA = (p: string) => {
    const r = PANTALLA_A_RUTA[p] ?? { tab: 'herramientas', mas: p }
    const params = new URLSearchParams(sp.toString()); for (const k of ['man_q', 'man_sec', 'man_abierta']) params.delete(k)
    params.set('tab', r.tab); if (r.mas) params.set('mas', r.mas); else params.delete('mas')
    router.replace(`/prototipo/admin?${params.toString()}`)
  }
  const nombrePermiso = (p: string) => ETIQUETA_PERMISO_MANUAL[p as keyof typeof ETIQUETA_PERMISO_MANUAL] ?? p
  const tarjeta = (e: EntradaManual) => {
    const ok = puedeLaEntrada(e, permisos, rol === 'admin'); const abiertaAhora = abierta === e.id
    return (
      <li key={e.id} className={`overflow-hidden rounded-2xl border bg-white ${abiertaAhora ? 'border-[var(--purple)]' : 'border-[var(--border-muted)]'} ${ok ? '' : 'opacity-70'}`}>
        <button onClick={() => setAbierta(abiertaAhora ? '' : e.id)} aria-expanded={abiertaAhora} className="flex min-h-14 w-full items-center gap-2 px-4 py-2 text-left">
          <span className="flex-1 font-extrabold">{e.titulo}</span>
          {!ok && <span className="shrink-0 rounded-full bg-[var(--warm-gray)] px-2 py-0.5 text-xs font-bold"></span>}
          <span aria-hidden className="text-[var(--text-light)]">{abiertaAhora ? '▾' : '▸'}</span>
        </button>
        {abiertaAhora && (
          <div className="border-t border-[var(--border-muted)] px-4 pb-4 pt-3">
            <p className="font-bold">{e.paraQue}</p>
            {!ok && <p role="note" className="mt-2 rounded-xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">{e.permiso === 'raiz' ? 'Solo un administrador puede hacer esto.' : `Necesitas el permiso "${nombrePermiso(String(e.permiso))}". Pídeselo a un administrador.`}</p>}
            <ol className="mt-3 grid gap-2">
              {e.pasos.map((p, i) => <li key={i} className="flex gap-3"><span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--purple)] text-sm font-extrabold text-white">{i + 1}</span><span className="pt-0.5">{p}</span></li>)}
            </ol>
            {e.despues && <p className="mt-3 rounded-xl bg-[var(--warm-gray)] p-3 text-sm text-[var(--text-mid)]">{e.despues}</p>}
            {e.pantalla && e.pantalla !== 'manual' && (
              <div className="mt-3 flex items-center gap-1">
                <button onClick={() => irA(e.pantalla!)} className="min-h-12 rounded-xl border-2 border-[var(--purple)] px-4 font-extrabold text-[var(--purple)]">Ir a esta pantalla</button>
                <InfoBoton que="Ir a esta pantalla" texto="Te lleva a la pantalla del panel donde se hace esto. No cambia nada." alineado="izquierda" />
              </div>
            )}
          </div>
        )}
      </li>
    )
  }
  return (
    <>
      <div className="flex items-center gap-1">
        <form onSubmit={(ev) => { ev.preventDefault(); setQ(texto.trim()); setAbierta('') }} className="flex min-w-0 flex-1 gap-1">
          <input type="search" value={texto} onChange={(ev) => { setTexto(ev.target.value); setQ(ev.target.value.trim()) }} placeholder="Busca con tus palabras: pago, no abre, pausa…" aria-label="Buscar en el manual" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] px-3 text-base" />
        </form>
        <InfoBoton que="Qué es el manual" texto="Responde las preguntas más comunes del equipo y se mantiene al día con el sistema. Busca con tus palabras o elige una sección. Las preguntas con candado necesitan un permiso que no tienes." />
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Secciones del manual">
        <button aria-pressed={sec === ''} onClick={() => setSec('')} className={`shrink-0 whitespace-nowrap ${chip(sec === '')}`}>Todo</button>
        {SECCIONES_MANUAL.map((x) => <button key={x.id} aria-pressed={sec === x.id} onClick={() => setSec(x.id)} className={`shrink-0 whitespace-nowrap ${chip(sec === x.id)}`}>{x.titulo}</button>)}
      </div>
      {lista.length === 0 && <p role="status" className="mt-4 rounded-2xl border border-dashed border-[var(--border-muted)] bg-white p-6 text-center text-[var(--text-mid)]">No encontré nada con esas palabras. Prueba con otras, o quita el filtro de sección.</p>}
      {q && lista.length > 0 && (
        <section className="mt-5">
          <h2 className="text-lg font-extrabold">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</h2>
          <p className="text-sm text-[var(--text-mid)]">Los más parecidos a lo que buscas, primero.</p>
          <ul className="mt-2 grid gap-2">{lista.map(tarjeta)}</ul>
        </section>
      )}
      {!q && SECCIONES_MANUAL.map((x) => {
        const delaSeccion = lista.filter((e) => e.seccion === x.id)
        if (delaSeccion.length === 0) return null
        return (
          <section key={x.id} className="mt-5">
            <h2 className="text-lg font-extrabold">{x.titulo}</h2>
            <p className="text-sm text-[var(--text-mid)]">{x.descripcion}</p>
            <ul className="mt-2 grid gap-2">{delaSeccion.map(tarjeta)}</ul>
          </section>
        )
      })}
      {!q && (!sec || sec === 'cuentas' || sec === 'configuracion') && (
        <section className="mt-6 grid gap-2">
          <h2 className="text-lg font-extrabold">Siempre al día</h2>
          <p className="text-sm text-[var(--text-mid)]">Estas dos listas se arman solas desde el sistema.</p>
          <details className="rounded-2xl border border-[var(--border-muted)] bg-white px-4 py-3"><summary className="cursor-pointer font-extrabold">Qué puede hacer cada permiso</summary>
            <ul className="mt-2 grid gap-1 text-sm">{permisosDelManual().map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.titulo}</span><span aria-label={permisos[p.id] ? 'Lo tienes' : 'No lo tienes'}></span></li>)}</ul></details>
          <details className="rounded-2xl border border-[var(--border-muted)] bg-white px-4 py-3"><summary className="cursor-pointer font-extrabold">Límites y esperas del sistema</summary>
            <ul className="mt-2 grid gap-2 text-sm">{limitesDelManual().map((l) => <li key={l.id}><div className="font-bold">{l.titulo}</div><div className="text-[var(--text-mid)]">{l.texto}</div></li>)}</ul></details>
        </section>
      )}
    </>
  )
}

function VistaEstado() {
  const filas: [string, string, boolean][] = [['Revisión de avisos (cada 5 min)', 'corrió hace 2 min', true], ['Avisos fallidos sin resolver', '0', true], ['Telegram', 'responde', true], ['Correo', 'responde', true], ['Videollamadas', 'responde', true], ['Limpieza diaria', 'corrió hoy 3:00 am', true], ['Timbre de Telegram: urgencias de la última hora', '3 de 8 (pasado el tope, un solo mensaje remite al panel)', true], ['Llamadas pendientes a compitas', '1, vence mañana 4:00 pm', true]]
  return (
    <>
      <div className="flex items-center gap-1"><span className="font-bold text-[var(--text-mid)]">Procesos y avisos</span><InfoBoton que="Qué es Estado del sistema" texto="Si algo automático deja de funcionar, aquí se ve en rojo y llega una alerta." alineado="izquierda" /></div>
      <DudasCompitas />
      <Lista>{filas.map(([t, v, b]) => <li key={t} className="flex items-center gap-3 px-3 py-3"><span className={`h-3 w-3 rounded-full ${b ? 'bg-[#1f9d6b]' : 'bg-[#D93A3A]'}`} /><span className="flex-1">{t}</span><span className="text-sm text-[var(--text-mid)]">{v}</span></li>)}</Lista>
    </>
  )
}

function Mas() {
  const rol = useContext(RolCtx)
  const puedeMas = usePuede()
  // Lo que se ve en Más depende de los permisos de quien entra; Equipo y Postulaciones son solo de administradores.
  const hub = HUB.filter((h) => {
    if (h.id === 'pagos') return puedeMas('pagos')
    if (h.id === 'invitar') return puedeMas('invitar')
    if (h.id === 'ajustes') return puedeMas('ajustes_ver') || puedeMas('ajustes_editar')
    if (h.id === 'equipo' || h.id === 'postulaciones') return rol === 'admin'
    return true
  })
  const [sub, setSub] = useUrlState('mas', '')
  const actual = hub.find((h) => h.id === sub && h.sub)
  if (actual) {
    return (
      <section>
        <Volver onClick={() => setSub(null)} />
        <h1 className="text-2xl font-extrabold">{actual.i} {actual.t}</h1>
        
        {sub === 'resenas' && <VistaResenas />}
        {sub === 'postulaciones' && <VistaPostulaciones />}
        {sub === 'pagos' && <VistaPagos />}
        {sub === 'avisos' && <VistaAvisos />}
        {sub === 'cobertura' && <VistaCobertura />}
        {sub === 'umbrales' && <VistaUmbrales />}
        {sub === 'ajustes' && <VistaAjustes />}
        {sub === 'equipo' && <VistaEquipo />}
        {sub === 'actividad' && <VistaActividad />}
        {sub === 'manual' && <VistaManual />}
        {sub === 'limites' && <VistaLimites />}
        {sub === 'registro' && <VistaRegistro />}
        {sub === 'estado' && <VistaEstado />}
      </section>
    )
  }
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Más</h1>
      <p className="text-[var(--text-mid)]">Herramientas que no son del día a día.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {hub.map((h) => {
          const cuerpo = (
            <>
              <div className="flex items-start justify-between gap-2"><div className="text-2xl">{h.i}</div></div>
              <div className="mt-2 text-lg font-extrabold">{h.t}</div>
              <div className="text-sm text-[var(--text-mid)]">{h.d}</div>
            </>
          )
          return h.sub ? (
            <button key={h.id} onClick={() => setSub(h.id)} className="rounded-2xl border border-[var(--border-muted)] bg-white p-4 text-left shadow-sm active:scale-[0.99]">{cuerpo}</button>
          ) : (
            <div key={h.id} className="rounded-2xl border border-dashed border-[var(--border-muted)] bg-white p-4">{cuerpo}</div>
          )
        })}
      </div>
    </section>
  )
}

function Pendiente({ titulo, texto }: { titulo: string; texto: string }) {
  return <section><h1 className="text-2xl font-extrabold">{titulo}</h1><p className="mt-2 rounded-2xl border border-dashed border-[var(--border-muted)] bg-white p-6 text-[var(--text-mid)]">{texto}</p></section>
}

const MENU = [
  { id: 'bandeja', t: 'Bandeja', i: '' },
  { id: 'seguimiento', t: 'Seguimiento', i: '' },
  { id: 'personas', t: 'Personas', i: '' },
  { id: 'visitas', t: 'Visitas', i: '' },
  { id: 'herramientas', t: 'Más', i: '' },
]

function Inner() {
  const embebido = useEmbedded() // dentro del recorrido el recuadro es angosto: siempre diseño de teléfono
  const [tab, setTab] = useUrlState('tab', 'bandeja')
  const [ficha, setFicha] = useUrlState('ficha', '')
  const [rolUrl, setRol] = useUrlState('rol', 'admin')
  const rol: Rol = rolUrl === 'colaborador' ? 'colaborador' : 'admin'
  const colabs = useSyncExternalStore(suscribirColabs, leerColabs, () => COLABS_INICIALES)
  const puedeIn = (pm: Permiso) => rol === 'admin' || !!colabs[0]?.permisos[pm]
  const permCtx: PermCtxValor = {
    colabs,
    cambiar: (id, pm, v) => {
      const c = colabs.find((x) => x.id === id)
      if (!c || c.permisos[pm] === v) return
      escribirColabs(colabs.map((x) => (x.id === id ? { ...x, permisos: { ...x.permisos, [pm]: v } } : x)))
      REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: 'Admin Juan', accion: `${v ? 'Activó' : 'Desactivó'} el permiso "${PERMISOS_LISTA.find((x) => x.id === pm)!.t}" de ${c.nombre}`, motivo: 'Gestión de permisos del equipo' })
    },
    restablecer: (id) => {
      const c = colabs.find((x) => x.id === id)
      if (!c) return
      escribirColabs(colabs.map((x) => (x.id === id ? { ...x, permisos: { ...PERMISOS_BASE } } : x)))
      REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: 'Admin Juan', accion: `Devolvió los permisos de ${c.nombre} a lo recomendado`, motivo: 'Gestión de permisos del equipo' })
    },
    invitar: (correoNuevo) => {
      const nombre = correoNuevo.split('@')[0].replace(/^./, (l) => l.toUpperCase())
      escribirColabs([...colabs, { id: correoNuevo, nombre, correo: correoNuevo, desde: 'Invitado hoy', permisos: { ...PERMISOS_BASE } }])
      REGISTRO_EXTRA.unshift({ cuando: `hoy ${horaAhora()}`, quien: 'Admin Juan', accion: `Invitó a ${correoNuevo} como colaborador`, motivo: 'Gestión del equipo' })
    },
  }
  const [chat, setChat] = useUrlState('chat', '') // "clienteId.compitaId": el chat abierto se conserva al recargar
  const [chatC, chatM] = chat ? chat.split('.') : ['', '']
  const persona = PERSONAS.find((p) => p.id === ficha)
  const abrir = (id: string) => setFicha(id)
  const menu = MENU.filter((m) => (m.id === 'bandeja' ? puedeIn('atender') : ['seguimiento', 'personas', 'visitas'].includes(m.id) ? puedeIn('monitorear') : true))
  const tabPermitida = tab === 'bandeja' ? puedeIn('atender') : ['seguimiento', 'personas', 'visitas'].includes(tab) ? puedeIn('monitorear') : true

  return (
    <RolCtx.Provider value={rol}>
    <PermCtx.Provider value={permCtx}>
    <VerChatCtx.Provider value={(c, m) => setChat(`${c}.${m}`)}>
    <div className={`mx-auto flex max-w-5xl ${embebido ? 'min-h-full flex-col' : ''}`}>
      <nav className={`sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-1 border-r border-[var(--border-muted)] p-4 ${embebido ? '' : 'lg:flex'}`} aria-label="Menú del admin">
        <div className="mb-4 text-lg font-extrabold text-[var(--purple)]">Compaz Admin</div>
        {menu.map((m) => (
          <button key={m.id} onClick={() => setTab(m.id)} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left font-bold ${tab === m.id ? 'bg-[var(--purple)] text-white' : 'hover:bg-[var(--warm-gray)]'}`}>
            <span>{m.i}</span>{m.t}{m.id === 'bandeja' && <span className="ml-auto rounded-full bg-[var(--orange)] px-2 text-xs text-white">{TODAS_TAREAS.length}</span>}
          </button>
        ))}
      </nav>

      <main className={`min-w-0 flex-1 px-4 pt-5 ${embebido ? 'pb-6' : 'pb-28 lg:pb-10'}`}>
        {!embebido && (
          <label className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--border-muted)] bg-white p-3 text-xs font-bold uppercase tracking-wider text-[var(--text-light)]">
            Ver el panel como
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="min-h-10 rounded-lg border border-[var(--border-muted)] bg-white px-2 text-base font-bold normal-case text-[var(--text-dark)]">
              <option value="admin">Administrador</option>
              <option value="colaborador">Colaborador (acceso limitado)</option>
            </select>
          </label>
        )}
        {!tabPermitida && <p role="alert" className="rounded-2xl border border-dashed border-[var(--border-muted)] bg-white p-6 text-center font-bold text-[var(--text-mid)]">No tienes permiso para ver esta pantalla. Pídeselo a un administrador.</p>}
        {tabPermitida && tab === 'bandeja' && <Bandeja abrir={abrir} />}
        {tabPermitida && tab === 'seguimiento' && <Seguimiento abrir={abrir} />}
        {tabPermitida && tab === 'personas' && <Personas abrir={abrir} />}
        {tabPermitida && tab === 'visitas' && <Visitas abrir={abrir} />}
        {tab === 'herramientas' && <Mas />}
      </main>

      <nav className={`${embebido ? 'sticky' : 'fixed inset-x-0'} bottom-0 z-30 grid border-t border-[var(--border-muted)] bg-white ${embebido ? '' : 'lg:hidden'}`} aria-label="Menú del admin" style={{ gridTemplateColumns: `repeat(${menu.length}, minmax(0, 1fr))` }}>
        {menu.map((m) => (
          <button key={m.id} onClick={() => setTab(m.id)} className={`relative flex min-h-16 flex-col items-center justify-center text-xs font-bold ${tab === m.id ? 'text-[var(--orange-dark)]' : 'text-[var(--text-mid)]'}`}>
            <span className="text-xl">{m.i}</span>{m.t}
            {m.id === 'bandeja' && <span className="absolute right-3 top-1 rounded-full bg-[var(--orange)] px-1.5 text-[10px] text-white">{TODAS_TAREAS.length}</span>}
          </button>
        ))}
      </nav>

      {persona && <Ficha p={persona} onClose={() => setFicha(null)} />}
      {chatC && chatM && <ChatAdmin clienteId={chatC} compitaId={chatM} onClose={() => setChat(null)} />}
    </div>
    </VerChatCtx.Provider>
    </PermCtx.Provider>
    </RolCtx.Provider>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
