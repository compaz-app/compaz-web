import InfoBoton from '@/components/ui/InfoBoton'
import AjustesForm from '@/components/panel/mas/AjustesForm'
import { CLASE_LISTA, TituloSeccion } from '@/components/panel/ui'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { DatosAjustes } from '@/lib/panel-ajustes'
import { esDelSemaforo } from '@/lib/panel-ajustes'

const INFO_AJUSTES = 'Aquí se cambian precios, plazos, topes y textos, y el cambio se aplica en todo el sistema a la vez: portal, página de pago, correos, Telegram, el asistente y la página web. Cada cambio queda registrado con quién lo hizo y cuándo, y no cambia lo ya pagado. Pasa el cursor por el ⓘ de cada ajuste para ver dónde se usa.'
const INFO_SEMAFORO = 'El punto de color de Seguimiento depende de cuántas horas lleva un cliente sin movimiento en su etapa: pasa a amarillo y luego a rojo. Aquí defines esas horas para cada etapa. El rojo siempre debe llegar después del amarillo. Rige desde ahora en Seguimiento y en el detalle de cada caso.'

// Ajustes (y, con `semaforo`, Ajustes del semáforo): la misma pantalla con los grupos que corresponden a cada herramienta.
export default function Ajustes({ d, puedeEditar, semaforo }: { d: DatosAjustes; puedeEditar: boolean; semaforo: boolean }) {
  const filas = d.ajustes.filter((a) => esDelSemaforo(a) === semaforo)
  const claves = new Set(filas.map((f) => f.clave))
  const historial = d.historial.filter((h) => claves.has(h.clave))
  // La pantalla se reinicia sola cuando cambian los valores guardados (así no queda un cambio viejo a medias).
  const firma = filas.map((f) => String(f.valor)).join('|').length + ':' + filas.reduce((s, f) => s + String(f.valor).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_003, 7), 0)
  return (
    <section className="max-w-3xl space-y-5">
      <p className="flex items-center gap-1 text-sm text-texto-medio">{semaforo ? 'Cuántas horas son normales en cada etapa antes de pasar a amarillo y a rojo.' : 'Precios, plazos, topes y textos del sistema.'}<InfoBoton que="Cómo funcionan los ajustes" texto={semaforo ? INFO_SEMAFORO : INFO_AJUSTES} /></p>
      <AjustesForm key={firma} filas={filas} puedeEditar={puedeEditar} />
      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>Cambios recientes</TituloSeccion><InfoBoton que="Qué es esto" texto="Cada ajuste que se cambia queda aquí con el valor anterior, el nuevo, quién lo hizo y cuándo. Es de solo inserción: nadie puede editarlo ni borrarlo." /></div>
        <ul className={CLASE_LISTA}>
          {historial.map((h, i) => <li key={i} className="px-3 py-2 text-sm"><span className="block"><b>{h.etiqueta}</b> <span className="text-texto-medio">{h.anterior} → {h.nuevo}</span></span><span className="text-xs text-texto-sutil">Por {h.por} · {cuandoLinea(h.cuando)}</span></li>)}
          {!historial.length && <li className="p-6 text-center text-sm text-texto-sutil">Todavía no se ha cambiado nada: rigen los valores de fábrica.</li>}
        </ul>
      </div>
    </section>
  )
}
