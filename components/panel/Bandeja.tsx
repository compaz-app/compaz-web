'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import { CLASE_LISTA, ChipBoton, Conteo, Encabezado, Filtros, Rol } from '@/components/panel/ui'
import AccionTarea from '@/components/panel/AccionTarea'
import { hrefPersona } from '@/lib/panel-personas-tipos'
import {
  INFO_BANDEJA, PAGINA_BANDEJA, TIPO_TODAS, cuantasMostrar, esEmergencia, etiquetaDeTarea, filtrarPorTipo, hace, limpiarNota, tiposConConteo,
  type TareaBandeja,
} from '@/lib/panel-bandeja-tipos'

const NOMBRE_ENTIDAD = { cliente: 'Cliente', compita: 'Compita', visita: 'Visita' } as const

// "Requiere tu atención". El tipo y cuántas se ven viven en la dirección (?tipo=, ?ver=) y se restauran al refrescar.
export default function Bandeja({ tareas, puedeAtender, pideMotivo }: { tareas: TareaBandeja[]; puedeAtender: boolean; pideMotivo: boolean }) {
  const router = useRouter()
  const ruta = usePathname()
  const params = useSearchParams()
  const [resueltas, setResueltas] = useState<Record<string, boolean>>({})
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const tipo = params.get('tipo') || TIPO_TODAS
  const como = params.get('como') === 'colaborador'
  const mostrar = cuantasMostrar(params.get('ver'))
  const fijar = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) { if (v === null) q.delete(k); else q.set(k, v) }
    router.replace(`${ruta}?${q.toString()}`, { scroll: false })
  }

  const activas = tareas.filter((t) => !resueltas[t.id])
  const lista = filtrarPorTipo(activas, tipo)
  const emergencias = activas.filter(esEmergencia).length

  async function resolver(id: string) {
    setEnCurso(id); setFallo(null)
    try {
      const r = await fetch('/api/admin/flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flag_id: id }) })
      if (!r.ok) throw new Error(String(r.status))
      setResueltas((h) => ({ ...h, [id]: true }))
      router.refresh()
    } catch {
      setFallo('No se pudo marcar como atendida. No se perdió nada: inténtalo otra vez.')
    } finally { setEnCurso(null) }
  }

  return (
    <section className="max-w-3xl space-y-3">
      <Encabezado titulo="Requiere tu atención" descripcion={activas.length ? `${activas.length} ${activas.length === 1 ? 'cosa esperando' : 'cosas esperando'}, lo más urgente primero.` : 'Todo al día 🎉'} info={INFO_BANDEJA} infoQue="Para qué sirve la Bandeja" />

      {emergencias > 0 && <Aviso tamano="compacto" tono="peligro">🚨 {emergencias === 1 ? '1 emergencia activa' : `${emergencias} emergencias activas`}. Atiéndela antes que cualquier otra tarea.</Aviso>}
      {fallo && <Aviso tamano="compacto" tono="peligro">{fallo}</Aviso>}

      <Filtros info="Muestra solo un tipo de tarea. El número es cuántas hay de cada tipo. No resuelve ni cambia nada." infoQue="Filtrar por tipo de tarea">
        {tiposConConteo(activas, tipo).map((x) => <ChipBoton key={x.tipo} activo={tipo === x.tipo} onClick={() => fijar({ tipo: x.tipo === TIPO_TODAS ? null : x.tipo, ver: null })}>{x.tipo}<Conteo n={x.n} /></ChipBoton>)}
      </Filtros>

      <ul className={CLASE_LISTA}>
        {lista.slice(0, mostrar).map((t) => (
          <li key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 ${esEmergencia(t) ? 'border-l-4 border-rojo bg-rojo-claro' : ''}`}>
            <div className="min-w-48 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                {(() => {
                  const nombre = t.entidad_id === 'sistema' ? 'Sistema' : t.entidad_nombre || 'Sin nombre'
                  const ir = t.entidad_id === 'sistema' ? null : hrefPersona(t.entidad_tipo, t.entidad_id, como)
                  return ir
                    ? <Link href={ir} aria-label={`Abrir la ficha de ${nombre}`} className="font-extrabold text-texto-oscuro underline-offset-2 [overflow-wrap:anywhere] hover:underline">{nombre}</Link>
                    : <span className="font-extrabold text-texto-oscuro [overflow-wrap:anywhere]">{nombre}</span>
                })()}
                <Rol>{t.entidad_id === 'sistema' ? 'Sistema' : NOMBRE_ENTIDAD[t.entidad_tipo]}</Rol>
                <Rol>{etiquetaDeTarea(t)}</Rol>
                <span className="text-xs text-texto-sutil">{hace(t.created_at)}</span>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-texto-medio [overflow-wrap:anywhere]">{limpiarNota(t.nota)}</p>
            </div>
            {puedeAtender && (
              <AccionTarea tarea={t} cerrando={enCurso === t.id} onCerrar={() => resolver(t.id)} onHecho={() => { setResueltas((h) => ({ ...h, [t.id]: true })); router.refresh() }} onRefrescar={() => router.refresh()} pideMotivo={pideMotivo} />
            )}
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-texto-sutil">Nada pendiente en esta categoría 🎉</li>}
      </ul>

      {lista.length > mostrar && (
        <div className="flex justify-center"><Boton tamano="compacto" variante="secundario" info="Muestra más tareas de la lista. No resuelve ni cambia nada." onClick={() => fijar({ ver: String(mostrar + PAGINA_BANDEJA) })}>
          Ver {Math.min(PAGINA_BANDEJA, lista.length - mostrar)} más ({lista.length - mostrar} restantes)
        </Boton></div>
      )}
    </section>
  )
}
