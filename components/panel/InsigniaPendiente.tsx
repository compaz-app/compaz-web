'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { usar, leer, type TipoPendiente } from '@/components/panel/pendientes-store'

const QUE: Record<TipoPendiente, (n: number) => string> = {
  bandeja: (n) => `${n} ${n === 1 ? 'tarea nueva' : 'tareas nuevas'} sin ver en la Bandeja`,
  pagos: (n) => `${n} ${n === 1 ? 'pago por confirmar' : 'pagos por confirmar'}`,
}

/**
 * El punto rojo con el número, como los mensajes sin leer. Bandeja: tareas nuevas que no has visto (se quita al abrir la Bandeja). Pagos: pagos por
 * confirmar (se quita al confirmarlos). No dibuja nada si no hay pendientes, ni mientras se cuenta la primera vez.
 */
export default function InsigniaPendiente({ tipo, esActiva, correo, compacta = false }: { tipo: TipoPendiente; esActiva: boolean; correo: string; compacta?: boolean }) {
  // La función de suscripción tiene que ser ESTABLE: si cambia en cada dibujo, React se desuscribe y se vuelve a suscribir cada vez, y cada suscripción cuenta
  // de nuevo (una consulta al servidor) y vuelve a cambiar el número, que vuelve a dibujar... un bucle de varias consultas por segundo (así se tumbó la web).
  const suscribir = useCallback((f: () => void) => usar(tipo, f, { esActiva, correo }), [tipo, esActiva, correo])
  const n = useSyncExternalStore(suscribir, () => leer(tipo), () => null)
  if (!n) return null
  const texto = n > 99 ? '99+' : String(n)
  return (
    <span role="status" aria-label={QUE[tipo](n)} title={QUE[tipo](n)}
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-rojo px-1.5 text-[11px] font-extrabold leading-5 text-blanco ${compacta ? 'absolute right-2 top-1.5' : 'ml-auto'}`}>
      {texto}
    </span>
  )
}
