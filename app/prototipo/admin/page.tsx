'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useUrlState } from '../useUrlState'

type Etapa = 'Solicitud' | 'Entrevista' | 'Decisión' | 'Pago' | 'Activo'
const ETAPAS: Etapa[] = ['Solicitud', 'Entrevista', 'Decisión', 'Pago', 'Activo']

type EstadoCompita = 'Disponible' | 'Con cupo' | 'En pausa' | 'Nuevo'
type StatsCompita = { estado: EstadoCompita; activos: number; visitas: number; rating: number; respuesta: number; inactivoH: number }

type Persona = { id: string; nombre: string; tipo: 'Cliente' | 'Compita'; zona: string; etapa?: Etapa; horas?: number; compita?: string; stats?: StatsCompita; nota: string; linea: { cuando: string; texto: string }[] }

const BASE: Persona[] = [
  { id: 'p1', horas: 3, nombre: 'Carolina Pérez', tipo: 'Cliente', zona: 'Miami → Chacao', etapa: 'Pago', compita: 'María', nota: 'Prefiere que le escriban por correo.', linea: [{ cuando: 'Hoy 9:41', texto: 'Dijo que sí quiere contratar a María' }, { cuando: 'Hoy 9:30', texto: 'Terminó la entrevista (21 min)' }, { cuando: 'Ayer 4:00 pm', texto: 'Entrevista programada' }, { cuando: 'Lun 11:12', texto: 'María aceptó la solicitud' }] },
  { id: 'p2', horas: 26, nombre: 'Luis Andrade', tipo: 'Cliente', zona: 'Madrid → Los Palos Grandes', etapa: 'Decisión', compita: 'Rosa', nota: '', linea: [{ cuando: 'Hoy 10:05', texto: 'Entrevista terminó, sin respuesta del cliente' }, { cuando: 'Hoy 9:40', texto: 'Entró a la entrevista' }] },
  { id: 'p3', horas: 8, nombre: 'Ana Gómez', tipo: 'Cliente', zona: 'Bogotá → Altamira', etapa: 'Solicitud', compita: 'Daniela', nota: '', linea: [{ cuando: 'Hoy 8:50', texto: 'Envió solicitud a Daniela' }] },
  { id: 'p4', horas: 0, nombre: 'Marta Salcedo', tipo: 'Cliente', zona: 'Panamá → Chacao', etapa: 'Activo', compita: 'María', nota: 'Madre de 82 años, usa bastón.', linea: [{ cuando: 'Mar 10:00', texto: 'Visita completada, 5 estrellas' }, { cuando: 'Lun 3:00 pm', texto: 'Pago confirmado' }] },
  { id: 'p5', horas: 0, nombre: 'Jorge Rivas', tipo: 'Cliente', zona: 'Lima → El Rosal', etapa: 'Entrevista', compita: 'Rosa', nota: '', linea: [{ cuando: 'Hoy 7:20', texto: 'Entrevista confirmada para mañana' }] },
  { id: 'p6', nombre: 'María Fuentes', tipo: 'Compita', zona: 'Chacao', nota: 'Muy puntual. Excelente con adultos mayores.', linea: [{ cuando: 'Hoy 9:30', texto: 'Terminó entrevista con Carolina' }, { cuando: 'Mar 10:00', texto: 'Visita completada' }] },
  { id: 'p7', nombre: 'Rosa Linares', tipo: 'Compita', zona: 'Los Palos Grandes', nota: '', linea: [{ cuando: 'Hoy 10:05', texto: 'Aviso de Telegram sin entregar' }] },
  { id: 'p8', nombre: 'Daniela Torres', tipo: 'Compita', zona: 'Altamira', nota: '', linea: [{ cuando: 'Hoy 8:50', texto: 'Nueva solicitud sin responder' }] },
]


const STATS_BASE: Record<string, StatsCompita> = {
  p6: { estado: 'Con cupo', activos: 2, visitas: 14, rating: 4.9, respuesta: 98, inactivoH: 1 },
  p7: { estado: 'Disponible', activos: 1, visitas: 6, rating: 4.4, respuesta: 62, inactivoH: 30 },
  p8: { estado: 'Disponible', activos: 0, visitas: 0, rating: 0, respuesta: 40, inactivoH: 80 },
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
const UMBRALES: Record<Etapa, [number, number]> = { Solicitud: [6, 24], Entrevista: [1, 3], Decisión: [2, 24], Pago: [2, 12], Activo: [24, 72] }
const URG_ESTILO: Record<Urgencia, string> = { verde: 'bg-[#1f9d6b] text-white', amarillo: 'bg-[#F5B800] text-[var(--purple-dark)]', rojo: 'bg-[#D93A3A] text-white' }
function urgenciaDe(p: Persona): Urgencia {
  if (!p.etapa) return 'verde'
  const [am, ro] = UMBRALES[p.etapa]
  const h = p.horas ?? 0
  return h >= ro ? 'rojo' : h >= am ? 'amarillo' : 'verde'
}

type Tarea = { id: string; tipo: string; icono: string; clienteId: string; compitaId: string; que: string; hace: string; boton: string; resuelta: string }
const TAREAS: Tarea[] = [
  { id: 't0', tipo: 'Emergencia', icono: '🚨', clienteId: 'p4', compitaId: 'p6', que: 'El compita activó el botón de emergencia durante una visita en curso', hace: 'hace 2 min', boton: 'Marcar atendida', resuelta: 'Atendida ✓' },
  { id: 't1', tipo: 'Pago', icono: '💵', clienteId: 'p1', compitaId: 'p6', que: 'URGENTE: el cliente insistió hace 8 min. Dice que ya pagó $75. Referencia COMPAZ-4F7K2Q', hace: 'hace 3 h', boton: 'Confirmar pago', resuelta: 'Pago confirmado ✓' },
  { id: 't2', tipo: 'Decisión', icono: '⏳', clienteId: 'p2', compitaId: 'p7', que: 'La entrevista terminó y el cliente no ha decidido si contrata', hace: 'hace 3 h', boton: 'Recordar al cliente', resuelta: 'Recordatorio enviado ✓' },
  { id: 't3', tipo: 'Aviso fallido', icono: '⚠️', clienteId: 'p5', compitaId: 'p7', que: 'Telegram no entregó al compita el aviso de nueva solicitud', hace: 'hace 25 min', boton: 'Reintentar aviso', resuelta: 'Reintento enviado ✓' },
  { id: 't5', tipo: 'Contacto bloqueado', icono: '🔒', clienteId: 'p2', compitaId: 'p7', que: 'Un mensaje del chat intentó compartir un teléfono o correo y fue censurado', hace: 'hace 40 min', boton: 'Marcar revisada', resuelta: 'Revisada ✓' },
  { id: 't4', tipo: 'Sin respuesta', icono: '🔔', clienteId: 'p3', compitaId: 'p8', que: 'El cliente envió una solicitud y el compita no ha respondido', hace: 'hace 5 h', boton: 'Insistir al compita', resuelta: 'Aviso reenviado ✓' },
]

// Tareas nuevas de los puntos 2 a 5: la escalera las abre sola cuando algo no se resuelve por el camino automático.
const NUEVAS: Tarea[] = [
  { id: 'n1', tipo: 'Nadie abre', icono: '🚪', clienteId: 'p4', compitaId: 'p6', que: 'El compita llegó (foto enviada) y nadie abre. Van 15 de 30 minutos. Ya se le escribió al contacto en el sitio a los 5 minutos', hace: 'hace 15 min', boton: 'Escribir al contacto otra vez', resuelta: 'Mensaje enviado ✓' },
  { id: 'n2', tipo: 'No me siento seguro', icono: '🛑', clienteId: 'p2', compitaId: 'p7', que: 'El compita salió de la visita por seguridad. El cliente recibió un aviso neutro. Decide si cobra la visita', hace: 'hace 6 min', boton: 'Llamar al compita y decidir', resuelta: 'Atendida ✓' },
  { id: 'n3', tipo: 'Visita alargada', icono: '⏱️', clienteId: 'p3', compitaId: 'p8', que: 'La visita pasó 25 minutos de su hora de fin y el compita no respondió "¿Todo bien?" en 10 minutos', hace: 'hace 10 min', boton: 'Contactar al compita', resuelta: 'Contactado ✓' },
  { id: 'n4', tipo: 'Ficha incompleta', icono: '📋', clienteId: 'p1', compitaId: 'p6', que: 'Pagó hace 2 días y aún no completa la ficha del familiar. No puede agendar su primera cita', hace: 'hace 2 d', boton: 'Llenarla por teléfono', resuelta: 'Ficha completada ✓' },
  { id: 'n5', tipo: 'Reporte de un compita', icono: '🚩', clienteId: 'p5', compitaId: 'p7', que: 'El compita reportó un problema con este cliente: "Me pidió hacer algo fuera del servicio" y marcó no volver con él', hace: 'hace 1 h', boton: 'Revisar y decidir', resuelta: 'Revisado ✓' },
  { id: 'n6', tipo: 'Cancelación tardía', icono: '📆', clienteId: 'p2', compitaId: 'p8', que: 'El compita canceló con menos de 24 horas. Es su segunda en 30 días: se abre revisión. La cita se reprograma sin costo', hace: 'hace 4 h', boton: 'Hablar con el compita', resuelta: 'Revisada ✓' },
  { id: 'n7', tipo: 'Contacto bloqueado', icono: '🔒', clienteId: 'p3', compitaId: 'p7', que: 'Segunda detección en 30 días: este cliente volvió a intentar compartir un teléfono. Ya se le había avisado que sería la última', hace: 'hace 50 min', boton: 'Marcar revisada', resuelta: 'Revisada ✓' },
]

function Ficha({ p, onClose }: { p: Persona; onClose: () => void }) {
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
          </div>
          <button onClick={onClose} className="min-h-10 rounded-xl border border-[var(--border-muted)] px-3 font-bold" aria-label="Cerrar ficha">Cerrar</button>
        </div>
        {p.etapa && <div className="mt-3 inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-sm font-bold">Etapa: {p.etapa}{p.compita ? ` · con ${p.compita}` : ''}</div>}
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
const TIPOS = ['Todas', 'Emergencia', 'No me siento seguro', 'Nadie abre', 'Visita alargada', 'Pago', 'Decisión', 'Ficha incompleta', 'Reporte de un compita', 'Cancelación tardía', 'Aviso fallido', 'Sin respuesta', 'Contacto bloqueado']
const PAGINA = 10

function Bandeja({ abrir }: { abrir: (id: string) => void }) {
  const [hechas, setHechas] = useState<Record<string, boolean>>({})
  const [tipo, setTipo] = useUrlState('tipo', 'Todas')
  const [mostrar, setMostrar] = useState(PAGINA)
  const activas = TODAS_TAREAS.filter((t) => !hechas[t.id])
  const lista = activas.filter((t) => tipo === 'Todas' || t.tipo === tipo)
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Requiere tu atención</h1>
      <p className="text-[var(--text-mid)]">{activas.length ? `${activas.length} cosas esperando` : 'Todo al día 🎉'}</p>

      {activas.some((t) => t.tipo === 'Emergencia') && (
        <div role="alert" className="mt-3 rounded-xl border-2 border-[#D93A3A] bg-[#FEF2F2] px-4 py-3 font-extrabold text-[#991B1B]">
          🚨 {activas.filter((t) => t.tipo === 'Emergencia').length} emergencia activa. Atiéndela antes que cualquier otra tarea.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {TIPOS.map((t) => {
          const n = t === 'Todas' ? activas.length : activas.filter((x) => x.tipo === t).length
          return (
            <button key={t} onClick={() => { setTipo(t); setMostrar(PAGINA) }} aria-pressed={tipo === t} className={`min-h-10 rounded-full px-3 text-sm font-bold ${tipo === t ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>
              {t} <span className="opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      <ul className="mt-3 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {lista.slice(0, mostrar).map((t) => {
          const cli = PERSONAS.find((x) => x.id === t.clienteId)!
          const cmp = PERSONAS.find((x) => x.id === t.compitaId)!
          return (
            <li key={t.id} className={`flex items-center gap-3 px-3 py-2 ${t.tipo === 'Emergencia' ? 'border-l-4 border-[#D93A3A] bg-[#FEF2F2]' : ''}`}>
              <span className="text-xl" aria-hidden>{t.icono}</span>
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
                  <span className="text-xs text-[var(--text-light)]">{t.hace}</span>
                </div>
                <div className="truncate text-sm text-[var(--text-mid)]">{t.que}</div>
              </div>
              <button onClick={() => setHechas((h) => ({ ...h, [t.id]: true }))} className="min-h-10 shrink-0 rounded-xl bg-[var(--orange)] px-3 text-sm font-extrabold text-white active:bg-[var(--orange-dark)]">{t.boton}</button>
            </li>
          )
        })}
        {!lista.length && <li className="p-6 text-center text-[var(--text-light)]">Nada pendiente en esta categoría 🎉</li>}
      </ul>

      {lista.length > mostrar && (
        <button onClick={() => setMostrar(mostrar + PAGINA)} className="mt-3 min-h-12 w-full rounded-xl border border-[var(--border-muted)] bg-white font-bold text-[var(--text-mid)]">
          Ver {Math.min(PAGINA, lista.length - mostrar)} más ({lista.length - mostrar} restantes)
        </button>
      )}
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

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                <button
                  onClick={(e) => { e.stopPropagation(); const c = PERSONAS.find((x) => x.tipo === 'Compita' && x.nombre.startsWith(p.compita ?? '')); if (c) abrir(c.id) }}
                  className="mt-0.5 flex items-center gap-1.5 rounded-full py-0.5 pr-2 text-sm text-[var(--text-mid)] hover:bg-[var(--warm-gray)]"
                  title={`Ver ficha de ${p.compita}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-[10px] font-extrabold text-white">{p.compita?.[0]}</span>
                  <span className="truncate underline decoration-[var(--border-muted)] underline-offset-2">{p.compita}</span>
                  <span className="text-[10px] font-extrabold uppercase text-[var(--orange-dark)]">Compita ›</span>
                </button>
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

const VISTAS: { id: string; t: string; f: (s: StatsCompita) => boolean }[] = [
  { id: 'todas', t: 'Todos', f: () => true },
  { id: 'disponibles', t: 'Disponibles', f: (s) => s.estado === 'Disponible' },
  { id: 'cupo', t: 'Con cupo', f: (s) => s.estado === 'Con cupo' },
  { id: 'sinrespuesta', t: 'Sin respuesta 24h', f: (s) => s.estado !== 'En pausa' && s.estado !== 'Nuevo' && s.inactivoH >= 24 },
  { id: 'pausa', t: 'En pausa', f: (s) => s.estado === 'En pausa' },
  { id: 'nuevas', t: 'Nuevos sin verificar', f: (s) => s.estado === 'Nuevo' },
]
function urgCompita(s: StatsCompita): Urgencia {
  if (s.estado === 'Nuevo' || s.estado === 'En pausa') return 'verde'
  if (s.respuesta < 50 || (s.rating > 0 && s.rating < 4) || s.inactivoH > 72) return 'rojo'
  if (s.respuesta < 75 || s.inactivoH > 24) return 'amarillo'
  return 'verde'
}
const ORD_URG: Record<Urgencia, number> = { rojo: 0, amarillo: 1, verde: 2 }
const COLUMNAS: { id: string; t: string; clase: string; v: (p: Persona) => number | string }[] = [
  { id: 'nombre', t: 'Nombre', clase: '', v: (p) => p.nombre },
  { id: 'zona', t: 'Zona', clase: 'hidden md:table-cell', v: (p) => p.zona },
  { id: 'estado', t: 'Estado', clase: 'hidden sm:table-cell', v: (p) => p.stats!.estado },
  { id: 'activos', t: 'Clientes', clase: 'hidden xl:table-cell', v: (p) => p.stats!.activos },
  { id: 'visitas', t: 'Visitas mes', clase: 'hidden xl:table-cell', v: (p) => p.stats!.visitas },
  { id: 'rating', t: '★', clase: '', v: (p) => p.stats!.rating },
  { id: 'respuesta', t: 'Respuesta', clase: 'hidden sm:table-cell', v: (p) => p.stats!.respuesta },
  { id: 'inactivo', t: 'Sin actividad', clase: 'hidden lg:table-cell', v: (p) => p.stats!.inactivoH },
]
const POR_PAG = 25

function Personas({ abrir }: { abrir: (id: string) => void }) {
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
            <button key={v.id} onClick={() => { setVista(v.id); setPag('1') }} aria-pressed={vista === v.id} className={`min-h-10 rounded-full px-3 text-sm font-bold ${vista === v.id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>
              {v.t} <span className="opacity-70">{n}</span>
            </button>
          )
        })}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPag('1') }} placeholder="Buscar por nombre o zona" className="mt-3 min-h-12 w-full rounded-xl border border-[var(--border-muted)] bg-white px-3 text-base sm:w-80" />

      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--warm-gray)] text-xs uppercase tracking-wider text-[var(--text-mid)]">
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c.id} className={`p-0 ${c.clase}`}>
                  <button onClick={() => ordenar(c.id)} className="flex min-h-10 w-full items-center gap-1 px-3 text-left font-extrabold uppercase">
                    {c.t}{orden === c.id ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
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
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${URG_ESTILO[urgCompita(s)]}`}>{p.nombre[0]}</span>
                      <span className="min-w-0"><span className="block truncate font-bold">{p.nombre}</span><span className="block truncate text-xs text-[var(--text-mid)] md:hidden">{p.zona} · {s.estado}</span></span>
                    </div>
                  </td>
                  <td className="hidden px-3 md:table-cell">{p.zona}</td>
                  <td className="hidden px-3 sm:table-cell">{s.estado}</td>
                  <td className="hidden px-3 xl:table-cell">{s.activos}</td>
                  <td className="hidden px-3 xl:table-cell">{s.visitas}</td>
                  <td className="px-3">{s.rating ? s.rating.toFixed(1) : '·'}</td>
                  <td className="hidden px-3 sm:table-cell">{s.respuesta ? `${s.respuesta}%` : '·'}</td>
                  <td className="hidden px-3 lg:table-cell">{s.inactivoH < 1 ? 'ahora' : `${s.inactivoH} h`}</td>
                  <td className="px-2 text-lg text-[var(--text-light)]">›</td>
                </tr>
              )
            })}
            {!fila.length && <tr><td colSpan={9} className="p-6 text-center text-[var(--text-light)]">Sin resultados</td></tr>}
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
type EstadoVisita = 'Programada' | 'En curso' | 'Terminada' | 'No se presentó'
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
  else estado = r < 0.08 ? 'No se presentó' : 'Terminada'
  const compitaId = COMPITAS_IDS[Math.floor(azar() * COMPITAS_IDS.length)]
  const comp = PERSONAS.find((x) => x.id === compitaId)!
  const rating = estado === 'Terminada' ? Math.min(5, Math.max(2, Math.round(3.6 + azar() * 1.9))) : null
  return { id: `v${i}`, ts, estado, clienteId: CLIENTES_IDS[Math.floor(azar() * CLIENTES_IDS.length)], compitaId, zona: comp.zona, rating }
})
// Cada regla corresponde a un dato real: el cron noshow-alerta (30 min) y visitas.rating_cliente.
const motivoProblema = (v: VisitaFalsa): string | null =>
  v.estado === 'No se presentó' ? 'No inició 30 min después de su hora' : v.rating !== null && v.rating <= 3 ? `El cliente la calificó con ${v.rating} estrellas` : null
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
}

function Visitas({ abrir }: { abrir: (id: string) => void }) {
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
      <p className="text-[var(--text-mid)]">Hoy es martes 3 de noviembre (fecha de la maqueta). Lo cerrado se consulta en Terminadas. &quot;Con problema&quot; muestra el motivo de cada fila.</p>
      <div className="mt-3 flex flex-wrap gap-2">
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
                </div>
                {motivoProblema(v) ? <div className="truncate text-xs font-bold text-[#D93A3A]">⚠ {motivoProblema(v)}</div> : <div className="truncate text-xs text-[var(--text-light)]">{v.zona}</div>}
              </div>
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
const MADUREZ: Record<Madurez, { t: string; c: string }> = {
  existe: { t: 'Existe hoy', c: 'bg-[#1f9d6b]/15 text-[#146c49]' },
  base: { t: 'Requiere base nueva', c: 'bg-[#F5B800]/25 text-[#7a5b00]' },
}
const HUB: { id: string; i: string; t: string; d: string; m: Madurez; sub: boolean }[] = [
  { id: 'resenas', i: '⭐', t: 'Reseñas por aprobar', d: 'Aprueba u oculta lo que el cliente escribe antes de que se vea en el perfil del compita.', m: 'existe', sub: true },
  { id: 'postulaciones', i: '📥', t: 'Postulaciones y origen', d: 'Quién se postuló, desde qué página o campaña llegó y si calificó.', m: 'existe', sub: true },
  { id: 'pagos', i: '💵', t: 'Pagos', d: 'Pagos registrados, con la opción de anular uno si hubo un error.', m: 'existe', sub: true },
  { id: 'avisos', i: '📨', t: 'Avisos enviados', d: 'Qué se le mandó a cada persona, por qué canal y si llegó. Aquí se reintentan los fallidos.', m: 'base', sub: true },
  { id: 'cobertura', i: '🗺️', t: 'Cobertura y demanda', d: 'Por zona: compitas disponibles frente a solicitudes del mes. Dónde falta reclutar.', m: 'existe', sub: true },
  { id: 'umbrales', i: '🚦', t: 'Ajustes del semáforo', d: 'Cuántas horas son normales en cada etapa antes de pasar a amarillo y rojo.', m: 'base', sub: true },
  { id: 'ajustes', i: '🎛️', t: 'Ajustes', d: 'Precios, plazos, topes y umbrales. Se cambian aquí, con registro de quién y cuándo; no hay que tocar el código.', m: 'base', sub: true },
  { id: 'cancelaciones', i: '📆', t: 'Cancelaciones de compitas', d: 'Quién cancela, con cuánta anticipación y si fue justificada. Para decidir si un compita sigue.', m: 'base', sub: true },
  { id: 'registro', i: '🗂️', t: 'Registro de actividad', d: 'Quién del equipo vio un teléfono o dato sensible, cuándo y por qué.', m: 'base', sub: true },
  { id: 'estado', i: '🩺', t: 'Estado del sistema', d: 'Procesos automáticos, avisos fallidos y salud de Telegram, correo y videollamadas.', m: 'base', sub: true },
  { id: 'invitar', i: '✉️', t: 'Invitar cliente y registrar compita', d: 'Ya están en el admin actual. Se mantienen tal cual.', m: 'existe', sub: false },
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
                <button onClick={() => setDec((d) => ({ ...d, [r.id]: 'Oculta ✓' }))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-4 font-bold">Ocultar</button>
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
    { id: 'g1', c: 'Carolina Pérez', plan: 'Quincenal', m: '$60', f: 'hoy', ref: 'COMPAZ-4F7K2Q' },
    { id: 'g2', c: 'Marta Salcedo', plan: 'Semanal', m: '$110', f: 'lun 2 nov', ref: 'COMPAZ-9X2LMA' },
    { id: 'g3', c: 'Jorge Rivas', plan: 'Carta', m: '$35', f: 'dom 1 nov', ref: 'COMPAZ-7TQ8RE' },
    { id: 'g4', c: 'Luis Andrade', plan: 'Quincenal', m: '$60', f: 'sáb 31 oct', ref: 'COMPAZ-2BD5NW' },
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
              <button onClick={() => setAnulados((a) => ({ ...a, [g.id]: true }))} className="min-h-10 rounded-xl border border-[var(--border-muted)] bg-white px-3 text-sm font-bold">Anular pago</button>
            )}
          </li>
        ))}
      </Lista>
    </>
  )
}

function VistaAvisos() {
  const datos = [
    { id: 'a1', cuando: 'hoy 10:05', canal: 'Telegram', para: 'Rosa Linares', rol: 'Compita', tipo: 'Nueva solicitud', ok: false, motivo: 'El compita bloqueó el bot' },
    { id: 'a2', cuando: 'hoy 09:41', canal: 'Correo', para: 'Carolina Pérez', rol: 'Cliente', tipo: 'Pago recibido', ok: true, motivo: '' },
    { id: 'a3', cuando: 'hoy 09:30', canal: 'Telegram', para: 'María Fuentes', rol: 'Compita', tipo: 'Entrevista en 1 hora', ok: true, motivo: '' },
    { id: 'a4', cuando: 'hoy 08:50', canal: 'Correo', para: 'Luis Andrade', rol: 'Cliente', tipo: '¿Contratas a Rosa?', ok: false, motivo: 'El correo rebotó (buzón lleno)' },
    { id: 'a5', cuando: 'ayer 18:20', canal: 'Telegram', para: 'Daniela Torres', rol: 'Compita', tipo: 'Nueva solicitud', ok: true, motivo: '' },
    { id: 'a6', cuando: 'ayer 16:02', canal: 'Correo', para: 'Ana Gómez', rol: 'Cliente', tipo: 'Solicitud enviada', ok: true, motivo: '' },
  ]
  const [vista, setVista] = useUrlState('av', 'todos')
  const [rein, setRein] = useState<Record<string, boolean>>({})
  const lista = datos.filter((d) => vista === 'todos' || !d.ok)
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada aviso queda guardado con su resultado. Reintentar reenvía el mismo aviso guardado. Esta pantalla depende de la tabla de avisos, que aún no existe.</p>
      <div className="mt-3 flex gap-2">
        {[['todos', 'Todos', datos.length], ['fallidos', 'Fallidos', datos.filter((d) => !d.ok).length]].map(([id, t, n]) => (
          <button key={id as string} onClick={() => setVista(id as string)} aria-pressed={vista === id} className={`min-h-10 rounded-full px-3 text-sm font-bold ${vista === id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>{t} <span className="opacity-70">{n}</span></button>
        ))}
      </div>
      <Lista>
        {lista.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2">
            <span aria-hidden>{d.canal === 'Telegram' ? '✈️' : '✉️'}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm"><b>{d.para}</b><span className={`rounded px-1 text-[10px] font-extrabold uppercase ${d.rol === 'Compita' ? 'bg-[var(--orange)]/15 text-[var(--orange-dark)]' : 'bg-[var(--purple)]/10 text-[var(--purple)]'}`}>{d.rol}</span><span className="text-xs text-[var(--text-light)]">{d.cuando}</span></div>
              <div className="truncate text-sm text-[var(--text-mid)]">{d.tipo}</div>
              {!d.ok && <div className="text-xs font-bold text-[#D93A3A]">⚠ {d.motivo}</div>}
            </div>
            {d.ok ? <span className="shrink-0 text-sm font-bold text-green-700">Entregado</span> : rein[d.id] ? <span className="shrink-0 text-sm font-bold text-green-700">Reenviado ✓</span> : (
              <button onClick={() => setRein((r) => ({ ...r, [d.id]: true }))} className="min-h-10 shrink-0 rounded-xl bg-[var(--orange)] px-3 text-sm font-extrabold text-white">Reintentar</button>
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
      <p className="text-[var(--text-mid)]">Horas en una etapa antes de pasar a amarillo y a rojo. Quedarían como un ajuste guardado, no escondido en el código.</p>
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
      <button onClick={() => setOk(true)} className="mt-3 min-h-12 rounded-xl bg-[var(--orange)] px-5 font-extrabold text-white">Guardar ajustes</button>
      {ok && <span className="ml-3 font-bold text-green-700">Guardado en la maqueta ✓</span>}
    </>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return <li className="flex items-center justify-between gap-3 px-3 py-3"><span className="text-base">{t}</span><b className="shrink-0 text-base">{v}</b></li>
}

function VistaAjustes() {
  const [ok, setOk] = useState(false)
  const grupos: { t: string; filas: [string, string][] }[] = [
    { t: 'Precios', filas: [['Hora de servicio', '$22'], ['Mandado (tarifa plana, máximo 1 hora)', '$22'], ['Plan Compañía (2 visitas de 2 h)', '$75'], ['Plan Compañía Plus (4 visitas de 2 h)', '$140']] },
    { t: 'Plazos de las citas', filas: [['Cancelación gratuita', '24 horas antes'], ['Espera si nadie abre', '30 minutos'], ['Contactos si nadie abre', 'a los 5 y 15 min'], ['"¿Todo bien?" si la visita se alarga', '15 minutos después'], ['Dirección exacta al compita', '3 horas antes']] },
    { t: 'Llamadas', filas: [['Llamada durante una visita', 'hasta 5 min'], ['Llamada fuera de una visita', 'hasta 20 min'], ['Videollamadas por cliente', '1 al día, 3 a la semana']] },
    { t: 'Seguridad y datos', filas: [['Detecciones de contacto antes de alertar al equipo', '2'], ['Ventana de conteo', '30 días'], ['Borrado de fotos de llegada', '90 días tras la visita'], ['Retención de avisos', '90 días']] },
  ]
  return (
    <>
      <p className="text-[var(--text-mid)]">Hoy estos valores están escondidos en el código. Aquí se cambian sin publicar nada. Cada cambio queda con quién lo hizo, cuándo y desde qué fecha vale; lo ya pagado no se altera.</p>
      {grupos.map((g) => (
        <div key={g.t} className="mt-4"><h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">{g.t}</h3><Lista>{g.filas.map(([t, v]) => <Fila key={t} t={t} v={v} />)}</Lista></div>
      ))}
      <button onClick={() => setOk(true)} className="mt-4 min-h-12 rounded-xl bg-[var(--orange)] px-5 font-extrabold text-white">Guardar cambios</button>
      {ok && <span className="ml-3 font-bold text-green-700">Guardado en la maqueta ✓</span>}
    </>
  )
}

function VistaCancelaciones() {
  const filas = [['Mariela R.', '3', '2', '1', 'Revisar: 2 tardías en 30 días'], ['Yoselin P.', '1', '0', '1', 'Sin alerta'], ['Gladys M.', '0', '0', '0', 'Sin alerta'], ['Carmen S.', '4', '3', '2', 'Pausar solicitudes nuevas']]
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada cancelación del compita queda registrada con su anticipación y su motivo. Las justificadas (enfermedad, emergencia familiar) no cuentan en su contra. Umbrales de partida: 2 tardías en 30 días abren revisión; 3 o más pausan sus solicitudes nuevas.</p>
      <Lista>
        <li className="grid grid-cols-5 gap-2 bg-[var(--warm-gray)] px-3 py-2 text-xs font-extrabold uppercase text-[var(--text-light)]"><span className="col-span-2">Compita</span><span>30 días</span><span>Tardías</span><span>90 días</span></li>
        {filas.map(([n, a, b, c, e]) => <li key={n} className="grid grid-cols-5 items-center gap-2 px-3 py-3"><span className="col-span-2 font-bold">{n}<span className="block text-xs font-normal text-[var(--text-mid)]">{e}</span></span><span>{a}</span><span>{b}</span><span>{c}</span></li>)}
      </Lista>
    </>
  )
}

function VistaRegistro() {
  const filas = [['hoy 10:42', 'Admin Juan', 'Vio el teléfono del contacto en el sitio', 'Nadie abre, visita de Carolina'], ['hoy 09:15', 'Admin Juan', 'Vio el teléfono del cliente', 'Confirmar pago'], ['ayer 18:03', 'Admin Ana', 'Llenó la ficha por teléfono', 'Ficha incompleta']]
  return (
    <>
      <p className="text-[var(--text-mid)]">Cada vez que alguien del equipo consulta un teléfono o un dato sensible queda anotado. Protege a los clientes y al equipo.</p>
      <Lista>{filas.map(([c, q, a, m]) => <li key={c + a} className="px-3 py-3"><div className="text-xs text-[var(--text-light)]">{c} · {q}</div><div className="font-bold">{a}</div><div className="text-sm text-[var(--text-mid)]">Motivo: {m}</div></li>)}</Lista>
    </>
  )
}

function VistaEstado() {
  const filas: [string, string, boolean][] = [['Revisión de avisos (cada 5 min)', 'corrió hace 2 min', true], ['Avisos fallidos sin resolver', '0', true], ['Telegram', 'responde', true], ['Correo', 'responde', true], ['Videollamadas', 'responde', true], ['Limpieza diaria', 'corrió hoy 3:00 am', true]]
  return (
    <>
      <p className="text-[var(--text-mid)]">Si algo automático deja de correr, aquí se ve en rojo y llega una alerta. Hoy esto solo se ve en los registros de la plataforma.</p>
      <Lista>{filas.map(([t, v, b]) => <li key={t} className="flex items-center gap-3 px-3 py-3"><span className={`h-3 w-3 rounded-full ${b ? 'bg-[#1f9d6b]' : 'bg-[#D93A3A]'}`} /><span className="flex-1">{t}</span><span className="text-sm text-[var(--text-mid)]">{v}</span></li>)}</Lista>
    </>
  )
}

function Mas() {
  const [sub, setSub] = useUrlState('mas', '')
  const actual = HUB.find((h) => h.id === sub && h.sub)
  if (actual) {
    return (
      <section>
        <Volver onClick={() => setSub(null)} />
        <h1 className="text-2xl font-extrabold">{actual.i} {actual.t}</h1>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${MADUREZ[actual.m].c}`}>{MADUREZ[actual.m].t}</span>
        {sub === 'resenas' && <VistaResenas />}
        {sub === 'postulaciones' && <VistaPostulaciones />}
        {sub === 'pagos' && <VistaPagos />}
        {sub === 'avisos' && <VistaAvisos />}
        {sub === 'cobertura' && <VistaCobertura />}
        {sub === 'umbrales' && <VistaUmbrales />}
        {sub === 'ajustes' && <VistaAjustes />}
        {sub === 'cancelaciones' && <VistaCancelaciones />}
        {sub === 'registro' && <VistaRegistro />}
        {sub === 'estado' && <VistaEstado />}
      </section>
    )
  }
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Más</h1>
      <p className="text-[var(--text-mid)]">Herramientas que no son del día a día, agrupadas. La etiqueta dice si ya existe o si necesita una base nueva.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {HUB.map((h) => {
          const cuerpo = (
            <>
              <div className="flex items-start justify-between gap-2"><div className="text-2xl">{h.i}</div><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MADUREZ[h.m].c}`}>{MADUREZ[h.m].t}</span></div>
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
  { id: 'bandeja', t: 'Bandeja', i: '🔔' },
  { id: 'seguimiento', t: 'Seguimiento', i: '🧭' },
  { id: 'personas', t: 'Personas', i: '👥' },
  { id: 'visitas', t: 'Visitas', i: '🏠' },
  { id: 'herramientas', t: 'Más', i: '⚙️' },
]

function Inner() {
  const [tab, setTab] = useUrlState('tab', 'bandeja')
  const [ficha, setFicha] = useUrlState('ficha', '')
  const persona = PERSONAS.find((p) => p.id === ficha)
  const abrir = (id: string) => setFicha(id)

  return (
    <div className="mx-auto flex max-w-5xl">
      <nav className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-1 border-r border-[var(--border-muted)] p-4 lg:flex" aria-label="Menú del admin">
        <div className="mb-4 text-lg font-extrabold text-[var(--purple)]">Compaz Admin</div>
        {MENU.map((m) => (
          <button key={m.id} onClick={() => setTab(m.id)} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left font-bold ${tab === m.id ? 'bg-[var(--purple)] text-white' : 'hover:bg-[var(--warm-gray)]'}`}>
            <span>{m.i}</span>{m.t}{m.id === 'bandeja' && <span className="ml-auto rounded-full bg-[var(--orange)] px-2 text-xs text-white">{TODAS_TAREAS.length}</span>}
          </button>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:pb-10">
        {tab === 'bandeja' && <Bandeja abrir={abrir} />}
        {tab === 'seguimiento' && <Seguimiento abrir={abrir} />}
        {tab === 'personas' && <Personas abrir={abrir} />}
        {tab === 'visitas' && <Visitas abrir={abrir} />}
        {tab === 'herramientas' && <Mas />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border-muted)] bg-white lg:hidden" aria-label="Menú del admin">
        {MENU.map((m) => (
          <button key={m.id} onClick={() => setTab(m.id)} className={`relative flex min-h-16 flex-col items-center justify-center text-xs font-bold ${tab === m.id ? 'text-[var(--orange-dark)]' : 'text-[var(--text-mid)]'}`}>
            <span className="text-xl">{m.i}</span>{m.t}
            {m.id === 'bandeja' && <span className="absolute right-3 top-1 rounded-full bg-[var(--orange)] px-1.5 text-[10px] text-white">{TODAS_TAREAS.length}</span>}
          </button>
        ))}
      </nav>

      {persona && <Ficha p={persona} onClose={() => setFicha(null)} />}
    </div>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
