'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TablaClientes, TablaCompitas, type DatosClientes, type DatosCompitas } from '@/components/panel/Personas'
import { datosClientes, datosCompitas, direccionCon, esMovimientoDeLista, leerParamsLista } from '@/lib/panel-personas-cliente'
import type { FilaCliente, FilaCompita } from '@/lib/panel-personas-tipos'

// Personas sin viajes al servidor: ordenar, filtrar, buscar y cambiar de página se resuelve aquí con la lista que ya llegó. Abrir una ficha sí va al
// servidor (necesita sus datos). La dirección se mantiene al día con replaceState, así refrescar restaura el mismo estado.
export default function PersonasInteractivo({ lista, compitas, clientes, qsInicial }: {
  lista: 'compitas' | 'clientes'; compitas?: FilaCompita[]; clientes?: FilaCliente[]; qsInicial: string
}) {
  const [qs, setQs] = useState(qsInicial)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Si el servidor entrega otra dirección (por ejemplo al abrir o cerrar una ficha), manda la del servidor.
  useEffect(() => { setQs(qsInicial) }, [qsInicial])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  const p = useMemo(() => leerParamsLista(qs), [qs])
  const d = useMemo(() => (lista === 'compitas' ? datosCompitas(compitas ?? [], p) : datosClientes(clientes ?? [], p)), [lista, compitas, clientes, p])
  const enlace = (cambios: Record<string, string | null>) => direccionCon(qs, cambios)

  // La barra de direcciones se actualiza con un pequeño retraso (algunos navegadores limitan cuántas veces se puede tocar el historial por segundo).
  function actualizarDireccion(nueva: string) {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => window.history.replaceState(null, '', nueva), 200)
  }
  function ir(nueva: string) { setQs(nueva.split('?')[1] ?? ''); actualizarDireccion(nueva) }

  function alClic(e: React.MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element).closest('a')
    if (!a || a.target || !a.getAttribute('href')) return
    const href = a.getAttribute('href') as string
    if (!esMovimientoDeLista(href, lista)) return // una ficha, un chat u otra sección: navegación normal
    e.preventDefault()
    a.closest('details')?.removeAttribute('open')
    ir(href)
  }

  const alBuscar = (q: string) => ir(direccionCon(qs, { q: q.trim() ? q : null, pag: null }))

  return (
    <div onClick={alClic}>
      {lista === 'compitas'
        ? <TablaCompitas d={d as DatosCompitas} enlace={enlace} params={{}} alBuscar={alBuscar} />
        : <TablaClientes d={d as DatosClientes} enlace={enlace} params={{}} alBuscar={alBuscar} />}
    </div>
  )
}
