'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import EliminarEnLote from '@/components/panel/EliminarEnLote'
import { TablaClientes, TablaCompitas, type DatosClientes, type DatosCompitas, type Seleccion } from '@/components/panel/Personas'
import { datosClientes, datosCompitas, direccionCon, esMovimientoDeLista, leerParamsLista } from '@/lib/panel-personas-cliente'
import type { FilaCliente, FilaCompita } from '@/lib/panel-personas-tipos'

// Personas sin viajes al servidor: ordenar, filtrar, buscar y cambiar de página se resuelve aquí con la lista que ya llegó. Abrir una ficha sí va al
// servidor (necesita sus datos). La dirección se mantiene al día con replaceState, así refrescar restaura el mismo estado.
/** Mismo tope que el servidor (lib/cuenta-eliminar.ts, MAX_ELIMINAR_LOTE): aquí no se importa ese archivo porque habla con la base de datos. */
const MAX_LOTE = 50

export default function PersonasInteractivo({ lista, compitas, clientes, qsInicial, puedeEliminar = false }: {
  lista: 'compitas' | 'clientes'; compitas?: FilaCompita[]; clientes?: FilaCliente[]; qsInicial: string
  /** Solo el administrador raíz puede eliminar: se muestran las casillas y la barra de acciones. */ puedeEliminar?: boolean
}) {
  const [qs, setQs] = useState(qsInicial)
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set())
  const [eliminando, setEliminando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Si el servidor entrega otra dirección (por ejemplo al abrir o cerrar una ficha), manda la del servidor.
  useEffect(() => { setQs(qsInicial) }, [qsInicial])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  const p = useMemo(() => leerParamsLista(qs), [qs])
  const d = useMemo(() => (lista === 'compitas' ? datosCompitas(compitas ?? [], p) : datosClientes(clientes ?? [], p)), [lista, compitas, clientes, p])
  const enlace = (cambios: Record<string, string | null>) => direccionCon(qs, cambios)

  // Lo que se puede marcar: todas las personas de esta lista (no solo la página). Si una ya no existe (se eliminó), su marca se quita sola.
  const todos: { id: string; nombre: string }[] = useMemo(() => (lista === 'compitas' ? compitas ?? [] : clientes ?? []).map((x) => ({ id: x.id, nombre: x.nombre })), [lista, compitas, clientes])
  const nombres = useMemo(() => Object.fromEntries(todos.map((x) => [x.id, x.nombre])), [todos])
  useEffect(() => { setMarcadas((m) => { const vivos = new Set(todos.map((x) => x.id)); const nuevo = new Set([...m].filter((id) => vivos.has(id))); return nuevo.size === m.size ? m : nuevo }) }, [todos])
  useEffect(() => { setMarcadas(new Set()) }, [lista])
  const idsPagina = (d.fila as { id: string }[]).map((f) => f.id)
  const seleccion: Seleccion | undefined = puedeEliminar ? {
    marcadas,
    alternar: (id) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    paginaCompleta: idsPagina.length > 0 && idsPagina.every((id) => marcadas.has(id)),
    alternarPagina: () => setMarcadas((m) => { const n = new Set(m); const todas = idsPagina.every((id) => n.has(id)); for (const id of idsPagina) { if (todas) n.delete(id); else n.add(id) } return n }),
  } : undefined

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

  const ids = [...marcadas]
  return (
    <div onClick={alClic}>
      {puedeEliminar && ids.length > 0 && (
        <div role="region" aria-label="Acciones sobre lo marcado" className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-lavanda-sutil p-2">
          <span className="text-sm font-bold">{ids.length} marcad{ids.length === 1 ? 'a' : 'as'}</span>
          <Boton tamano="compacto" variante="peligro" info="Elimina las cuentas marcadas, una por una, con las mismas reglas que eliminarlas sola. Antes te pide confirmar." onClick={() => setEliminando(true)} disabled={ids.length > MAX_LOTE}>Eliminar marcadas</Boton>
          <Boton tamano="compacto" variante="fantasma" info="Quita todas las marcas sin cambiar nada." onClick={() => setMarcadas(new Set())}>Quitar marcas</Boton>
          {ids.length > MAX_LOTE && <span className="text-xs font-bold text-rojo-oscuro">Máximo {MAX_LOTE} por vez: quita algunas.</span>}
        </div>
      )}
      {lista === 'compitas'
        ? <TablaCompitas d={d as DatosCompitas} enlace={enlace} params={{}} alBuscar={alBuscar} seleccion={seleccion} />
        : <TablaClientes d={d as DatosClientes} enlace={enlace} params={{}} alBuscar={alBuscar} seleccion={seleccion} />}
      {eliminando && (
        <EliminarEnLote tipo={lista === 'compitas' ? 'compita' : 'cliente'} ids={ids} nombres={nombres} cerrar={() => setEliminando(false)}
          alTerminar={(fallidas) => setMarcadas(new Set(fallidas))} />
      )}
    </div>
  )
}
