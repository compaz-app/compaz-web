'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import { EncabezadoLateral } from '@/components/panel/ui'
import MotivoDialog from '@/components/panel/MotivoDialog'
import { agruparChat } from '@/lib/panel-chat-tipos'
import type { MensajePanel } from '@/lib/panel-personas-tipos'

type Cargado = { cliente: string; compita: string; mensajes: MensajePanel[] }
// Sin globos de colores: solo una barra fina y el nombre en el color de cada parte, para distinguirlas de un vistazo.
const ESTILO: Record<MensajePanel['de'], { barra: string; nombre: string }> = {
  Cliente: { barra: 'bg-morado-medio', nombre: 'text-morado-medio' },
  Compita: { barra: 'bg-naranja', nombre: 'text-naranja-oscuro' },
  Compaz: { barra: 'bg-gris200', nombre: 'text-texto-sutil' },
}

// El chat entre un cliente y un compita, como panel lateral. Se abre con ?chat=<cliente>:<compita>. Un colaborador da un motivo primero;
// cada apertura queda anotada en Actividad (también al refrescar la página). Solo lectura.
export default function VerChat({ clienteId, compitaId, cerrarHref, pideMotivo, fichaClienteHref, fichaCompitaHref }: {
  clienteId: string; compitaId: string; cerrarHref: string; pideMotivo: boolean; fichaClienteHref: string | null; fichaCompitaHref: string | null
}) {
  const router = useRouter()
  const [datos, setDatos] = useState<Cargado | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [preguntar, setPreguntar] = useState(pideMotivo)
  const pedido = useRef(false)
  // Qué días están abiertos. Por defecto solo el más reciente: con un mes de conversación no hay que recorrerlo todo.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const cargar = useCallback(async (motivo?: string) => {
    setPreguntar(false); setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, compitaId, motivo }) })
      const j = await r.json().catch(() => null) as { ok: boolean; data?: Cargado; error?: string } | null
      if (!r.ok || !j?.ok || !j.data) throw new Error(j?.error ?? 'No se pudo abrir el chat')
      setDatos(j.data)
    } catch (e) { setFallo(e instanceof Error ? e.message : 'No se pudo abrir el chat') } finally { setCargando(false) }
  }, [clienteId, compitaId])

  // Administrador: entra directo, una sola vez por apertura (el servidor lo anota).
  useEffect(() => { if (!pideMotivo && !pedido.current) { pedido.current = true; void cargar() } }, [pideMotivo, cargar])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') router.replace(cerrarHref, { scroll: false }) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [router, cerrarHref])

  const dias = datos ? agruparChat(datos.mensajes, Date.now()) : []
  const estaAbierto = (dia: string, i: number) => abiertos[dia] ?? i === dias.length - 1
  const todosAbiertos = dias.length > 0 && dias.every((d, i) => estaAbierto(d.dia, i))

  if (preguntar) return <MotivoDialog titulo="¿Por qué necesitas ver este chat?" texto="Es una conversación privada entre un cliente y su compita. Como colaborador, debes indicar un motivo. Queda anotado junto con tu nombre." continuar="Ver el chat" info="Abre la conversación privada entre el cliente y el compita. Tu motivo y tu nombre quedan en Actividad. Es solo lectura." onListo={cargar} onCancelar={() => router.replace(cerrarHref, { scroll: false })} />

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-negro/30">
      <button type="button" aria-label="Cerrar chat" className="absolute inset-0 cursor-default" onClick={() => router.replace(cerrarHref, { scroll: false })} />
      <aside role="dialog" aria-label="Chat entre cliente y compita" className="relative h-full w-full max-w-md space-y-3 overflow-y-auto bg-blanco p-5 shadow-2xl">
        <EncabezadoLateral etiqueta="Chat" titulo={datos ? <>{datos.cliente} <span className="text-texto-sutil">↔</span> {datos.compita}</> : 'Abriendo…'} cerrarHref={cerrarHref} />
        {cargando && <p className="text-texto-medio">Un momento…</p>}
        {fallo && <Aviso tamano="compacto" tono="peligro">{fallo}</Aviso>}
        {datos && (
          <>
            <p className="text-xs text-texto-sutil">🔒 Solo el equipo ve esta conversación. Quedó anotado en Actividad que la abriste.</p>
            {dias.length === 0 ? <p className="text-sm text-texto-sutil">Todavía no hay mensajes entre ellos.</p> : (
              <div className="space-y-2" aria-label="Mensajes">
                {dias.length > 1 && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setAbiertos(Object.fromEntries(dias.map((d) => [d.dia, !todosAbiertos])))} className="text-xs font-bold text-morado-claro underline-offset-2 hover:underline">{todosAbiertos ? 'Cerrar todos los días' : 'Abrir todos los días'}</button>
                  </div>
                )}
                {dias.map((d, di) => {
                  const abierto = estaAbierto(d.dia, di)
                  const n = d.bloques.reduce((s, b) => s + b.lineas.length, 0)
                  return (
                    <section key={d.dia} aria-label={d.etiqueta}>
                      <h3>
                        <button type="button" aria-expanded={abierto} onClick={() => setAbiertos((a) => ({ ...a, [d.dia]: !abierto }))} className="flex w-full items-center gap-2 py-1 text-left text-xs font-bold text-texto-medio">
                          <span aria-hidden className="w-3 text-texto-sutil">{abierto ? '▾' : '▸'}</span>
                          <span className="first-letter:uppercase">{d.etiqueta}</span>
                          <span className="font-normal text-texto-sutil">{n} {n === 1 ? 'mensaje' : 'mensajes'}</span>
                          <span aria-hidden className="h-px flex-1 bg-borde" />
                        </button>
                      </h3>
                      {abierto && (
                        <ol className="mt-1.5 space-y-2.5">
                          {d.bloques.map((b, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span aria-hidden className={`w-0.5 shrink-0 rounded-full ${ESTILO[b.de].barra}`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-extrabold uppercase tracking-wide ${ESTILO[b.de].nombre}`}>{b.de}</p>
                                {b.lineas.map((l, k) => (
                                  <p key={k} className="flex items-baseline justify-between gap-3 text-sm leading-snug">
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{l.esFoto ? '📷 Envió una foto' : l.texto || '·'}</span>
                                    <time className="shrink-0 text-[11px] text-texto-sutil">{l.hora}</time>
                                  </p>
                                ))}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {fichaClienteHref && <Boton tamano="compacto" variante="secundario" navegacion href={fichaClienteHref}>Ficha del cliente</Boton>}
              {fichaCompitaHref && <Boton tamano="compacto" variante="secundario" navegacion href={fichaCompitaHref}>Ficha del compita</Boton>}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
