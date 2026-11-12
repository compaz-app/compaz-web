import { CLASE_LISTA, TituloSeccion } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import { PuntoUrgencia } from '@/components/panel/Personas'
import AutoRefresh from '@/components/ui/AutoRefresh'
import BotonReintentar from '@/components/panel/mas/BotonReintentar'
import MedirVelocidad from '@/components/panel/mas/MedirVelocidad'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { EstadoSistema } from '@/lib/panel-estado'

const TEXTO = { ok: { u: 'verde', t: 'Corriendo' }, caido: { u: 'rojo', t: 'Dejó de correr' }, sin_registro: { u: 'neutro', t: 'Sin registro todavía' } } as const
const NOMBRE_PROCESO: Record<string, string> = {
  recordatorios: 'Recordatorios a clientes', seguimiento: 'Seguimiento tras la entrevista', 'escalera-avisos': 'Revisión de avisos sin respuesta', 'recordatorio-cuestionario': 'Recordatorio del cuestionario',
  'cierre-rechazo': 'Cierre de solicitudes rechazadas', 'recordatorio-visita': 'Recordatorio de visitas', 'reintentar-airtable': 'Reintento de envíos a Airtable', 'conciliar-airtable': 'Conciliación con Airtable',
}
const hace = (iso: string, ahora: number) => { const m = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000)); return m < 1 ? 'hace menos de 1 min' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d` }

// Estado del sistema: solo lo que se puede saber de la base de datos (procesos automáticos y avisos). No hace llamadas de prueba a Telegram, correo ni videollamadas.
export default function Estado({ e, ahora, puedeReintentar, esAdmin = false }: { e: EstadoSistema; ahora: number; puedeReintentar: boolean; esAdmin?: boolean }) {
  const fila = 'flex items-center gap-3 px-3 py-2 text-sm'
  return (
    <section className="max-w-3xl space-y-4">
      <AutoRefresh intervaloSeg={60} />
      <div>
        <div className="flex items-center gap-1"><TituloSeccion>Procesos automáticos</TituloSeccion><InfoBoton que="Qué son los procesos automáticos" texto="Tareas que el sistema hace solo cada cierto tiempo (recordatorios, seguimientos, reintentos). Si uno pasa más de 3 veces su intervalo sin dar señal, se marca en rojo y llega una alerta por Telegram." /></div>
        <ul className={`${CLASE_LISTA} mt-2`}>
          {e.procesos.map((p) => (
            <li key={p.nombre} className={fila}>
              <PuntoUrgencia u={TEXTO[p.estado].u} texto={TEXTO[p.estado].t} />
              <span className="min-w-0 flex-1">{NOMBRE_PROCESO[p.nombre] ?? p.nombre}<span className="block text-xs text-texto-sutil">Cada {p.cadaMin} min</span></span>
              <span className="shrink-0 text-xs text-texto-medio">{p.ultimo ? hace(p.ultimo, ahora) : 'Sin registro'}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center gap-1"><TituloSeccion>Avisos y envíos</TituloSeccion><InfoBoton que="Qué son los avisos fallidos" texto="Mensajes que el sistema intentó mandar por Telegram o correo y no llegaron. Los fallidos se reintentan solos; si siguen aquí, hay que revisar la causa que dice cada uno." /></div>
        <ul className={`${CLASE_LISTA} mt-2`}>
          <li className={fila}><PuntoUrgencia u={e.fallidos === 0 ? 'verde' : 'rojo'} texto={e.fallidos === 0 ? 'Sin fallidos' : 'Hay fallidos'} /><span className="flex-1">Avisos fallidos</span><b>{e.fallidos}</b></li>
          <li className={fila}><PuntoUrgencia u="neutro" texto="Informativo" /><span className="flex-1">Avisos pendientes de enviar</span><b>{e.pendientes}</b></li>
          <li className={fila}><PuntoUrgencia u={e.airtablePendientes === 0 ? 'verde' : 'amarillo'} texto={e.airtablePendientes === 0 ? 'Al día' : 'Con pendientes'} /><span className="flex-1">Postulaciones sin enviar a Airtable</span><b>{e.airtablePendientes}</b></li>
        </ul>
        {e.ultimosFallidos.length > 0 && (
          <ul className={`${CLASE_LISTA} mt-2`}>
            {e.ultimosFallidos.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2"><b>{a.plantilla}</b><span className="text-xs text-texto-sutil">{a.canal} · {a.intentos} {a.intentos === 1 ? 'intento' : 'intentos'}{a.ultimo ? ` · ${cuandoLinea(a.ultimo)}` : ''}</span></div>
                  <p className="text-xs text-texto-medio [overflow-wrap:anywhere]">{a.error ?? 'Sin detalle del error.'}</p>
                </div>
                {puedeReintentar && <BotonReintentar avisoId={a.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="flex items-center gap-1"><TituloSeccion>Dudas de los compitas ({e.dudas.dias} días)</TituloSeccion><InfoBoton que="Qué son las dudas" texto="Lo que preguntan los compitas en el botón Tengo una duda. Si un tipo domina, el problema está en el formulario o en el aviso, y conviene arreglarlo ahí. Las que el bot no resuelve pasan a una persona (una tarea en la Bandeja)." /></div>
        {e.dudas.total === 0 ? <p className="mt-2 rounded-xl border border-borde bg-blanco px-3 py-2 text-sm text-texto-sutil">Ningún compita ha tocado "Tengo una duda" en estos días.</p> : (
          <div className="mt-2 space-y-2 rounded-xl border border-borde bg-blanco p-3">
            <p className="text-sm text-texto-medio">{e.dudas.total} {e.dudas.total === 1 ? 'duda' : 'dudas'}; {e.dudas.noResueltas} no se resolvieron con el bot y {e.dudas.escaladas} pasaron a una persona. {e.dudas.tareasAbiertas > 0 ? `Hay ${e.dudas.tareasAbiertas} ${e.dudas.tareasAbiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} en la Bandeja.` : ''}</p>
            <ul className="space-y-1.5">
              {e.dudas.tipos.map((t) => (
                <li key={t.tipo}>
                  <div className="flex justify-between text-sm"><span>{t.texto}</span><b>{t.n} ({Math.round((t.n / e.dudas.total) * 100)} %)</b></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gris100"><div className="h-full bg-naranja" style={{ width: `${Math.round((t.n / e.dudas.total) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="text-xs text-texto-sutil">Telegram, correo y videollamadas no se prueban desde aquí. Si fallan, lo verás arriba como avisos fallidos.</p>
      {esAdmin && (
        <div>
          <div className="flex items-center gap-1"><TituloSeccion>Velocidad</TituloSeccion><InfoBoton que="Qué es Velocidad" texto="Mide cuánto tarda el servidor en consultar la base de datos. Si el panel se siente lento, aquí se ve si es por la distancia entre ambos. Solo la ve el administrador." /></div>
          <div className="mt-2"><MedirVelocidad /></div>
        </div>
      )}
    </section>
  )
}
