'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import { EncabezadoLateral, TituloBloque } from '@/components/panel/ui'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import MotivoDialog from '@/components/panel/MotivoDialog'
import CuentaPersona from '@/components/panel/CuentaPersona'
import EstadoCmc from '@/components/panel/EstadoCmc'
import { INFO_CONTACTO, MAX_NOTA, cuandoLinea, digitosWhatsapp, type CanalContacto, type FichaPersona as Ficha, type NotaPersona } from '@/lib/panel-personas-tipos'

const TEXTO_CANAL: Record<CanalContacto, string> = { correo: 'Correo', telefono: 'Teléfono', whatsapp: 'WhatsApp' }

// Ficha de una persona (cliente o compita) como panel lateral. Se abre con ?persona= y se cierra volviendo a la lista.
// Los datos de contacto no vienen con la ficha: se piden uno a uno, con motivo si no eres administrador, y quedan en Actividad.
export default function FichaPersona({ ficha, cerrarHref, pideMotivo, puedeContacto, puedeNotas, puedeCuentas, puedeEliminar, chatHref }: { ficha: Ficha; cerrarHref: string; pideMotivo: boolean; puedeContacto: boolean; puedeNotas: boolean; puedeCuentas: boolean; puedeEliminar: boolean; chatHref: string | null }) {
  const router = useRouter()
  const [valores, setValores] = useState<Partial<Record<CanalContacto, string>>>({})
  const [pidiendo, setPidiendo] = useState<CanalContacto | null>(null)
  const [cargando, setCargando] = useState<CanalContacto | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [notas, setNotas] = useState<NotaPersona[]>(ficha.notas)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [falloNota, setFalloNota] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') router.replace(cerrarHref, { scroll: false }) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [router, cerrarHref])

  async function pedir(canal: CanalContacto, motivo?: string) {
    setPidiendo(null); setCargando(canal); setFallo(null)
    try {
      const r = await fetch('/api/admin/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: ficha.tipo, id: ficha.id, canal, motivo }) })
      const j = await r.json().catch(() => null) as { ok: boolean; data?: { valor: string }; error?: string } | null
      if (!r.ok || !j?.ok || !j.data) throw new Error(j?.error ?? 'No se pudo mostrar el dato')
      setValores((v) => ({ ...v, [canal]: j.data!.valor }))
      if (canal === 'whatsapp') window.open(`https://wa.me/${digitosWhatsapp(j.data.valor)}`, '_blank', 'noopener,noreferrer')
      if (canal === 'correo') window.location.href = `mailto:${j.data.valor}`
    } catch (e) { setFallo(e instanceof Error ? e.message : 'No se pudo mostrar el dato') } finally { setCargando(null) }
  }
  async function guardarNota() {
    setGuardando(true); setFalloNota(null)
    try {
      const r = await fetch('/api/admin/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: ficha.tipo, id: ficha.id, texto: borrador }) })
      const j = await r.json().catch(() => null) as { ok: boolean; data?: NotaPersona; error?: string } | null
      if (!r.ok || !j?.ok || !j.data) throw new Error(j?.error ?? 'No se pudo guardar la nota')
      setNotas((n) => [j.data!, ...n]); setBorrador('')
    } catch (e) { setFalloNota(e instanceof Error ? e.message : 'No se pudo guardar la nota') } finally { setGuardando(false) }
  }
  const quiere = (canal: CanalContacto) => (pideMotivo && !valores[canal] ? setPidiendo(canal) : pedir(canal))

  const canales: CanalContacto[] = [...(ficha.contacto.correo ? ['correo' as const] : []), ...(ficha.contacto.telefono ? ['telefono' as const, 'whatsapp' as const] : [])]

  const infoCanal = (c: CanalContacto) => `Muestra ${c === 'correo' ? 'el correo' : 'el teléfono'}${c === 'correo' ? ' y abre tu programa de correo' : c === 'whatsapp' ? ' y abre WhatsApp para escribirle' : ''}. ${pideMotivo ? 'Te pide un motivo y queda anotado en Actividad.' : 'Queda anotado en Actividad.'}`
  const textoCanal: Record<CanalContacto, string> = { correo: 'Ver correo', telefono: 'Ver teléfono', whatsapp: 'WhatsApp' }
  
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-negro/30">
      <button type="button" aria-label="Cerrar ficha" className="absolute inset-0 cursor-default" onClick={() => router.replace(cerrarHref, { scroll: false })} />
      <aside role="dialog" aria-label={`Ficha de ${ficha.nombre}`} className="relative h-full w-full max-w-md space-y-5 overflow-y-auto bg-blanco p-5 shadow-2xl">
        <EncabezadoLateral etiqueta={ficha.tipo === 'cliente' ? 'Cliente' : 'Compita'} titulo={ficha.nombre || 'Sin nombre'} detalle={ficha.zona || 'Sin zona'} cerrarHref={cerrarHref} />

        {(ficha.etapa || (chatHref && ficha.compita)) && (
          <div className="flex flex-wrap items-center gap-2">
            {ficha.etapa && <span className="rounded-full bg-amarillo-claro px-3 py-1 text-xs font-bold text-ambar-oscuro">Paso: {ficha.etapa}{ficha.compita ? ` · con ${ficha.compita}` : ''}</span>}
            {chatHref && ficha.compita && <Boton tamano="compacto" variante="secundario" navegacion href={chatHref}>Ver chat</Boton>}
          </div>
        )}
        {ficha.canc && ficha.canc.total > 0 && (
          <Aviso tamano="compacto" tono={ficha.canc.nivel === 'normal' ? 'info' : 'advertencia'}>
            {ficha.canc.total} cancelación{ficha.canc.total > 1 ? 'es' : ''} en 30 días, {ficha.canc.cuentanContra} tardía{ficha.canc.cuentanContra === 1 ? '' : 's'} sin justificar{ficha.canc.nivel === 'pausa' ? '. Sus solicitudes nuevas están en pausa.' : ficha.canc.nivel === 'revision' ? '. En revisión.' : '.'}
          </Aviso>
        )}

        {ficha.cmc && <EstadoCmc cmc={ficha.cmc} />}

        <CuentaPersona ficha={ficha} puedeCuentas={puedeCuentas} puedeAtender={puedeNotas} puedeEliminar={puedeEliminar} />

        {puedeContacto && canales.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1"><TituloBloque>Contacto</TituloBloque><InfoBoton que="Qué es Contacto" texto={INFO_CONTACTO} /></div>
            {fallo && <Aviso tamano="compacto" tono="peligro">{fallo}</Aviso>}
            <ul className="divide-y divide-borde rounded-xl border border-borde">
              {canales.map((c) => (
                <li key={c} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
                  <span className="text-sm text-texto-medio">{TEXTO_CANAL[c]}</span>
                  {valores[c] && c !== 'whatsapp'
                    ? <b className="min-w-0 text-sm [overflow-wrap:anywhere]">{valores[c]}</b>
                    : <Boton tamano="compacto" variante="secundario" info={infoCanal(c)} cargando={cargando === c} onClick={() => quiere(c)}>{textoCanal[c]}</Boton>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <TituloBloque>Línea de tiempo</TituloBloque>
          {ficha.linea.length === 0 ? <p className="mt-2 text-sm text-texto-sutil">Todavía no hay nada que contar.</p> : (
            <ol className="mt-3 border-l border-borde pl-4">
              {ficha.linea.map((l, i) => (
                <li key={i} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-5 top-1.5 h-2 w-2 rounded-full bg-naranja" />
                  <p className="text-xs text-texto-sutil">{cuandoLinea(l.cuando)}</p>
                  <p className="text-sm [overflow-wrap:anywhere]">{l.texto}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-1"><TituloBloque>Notas internas</TituloBloque><InfoBoton que="Qué son las notas internas" texto="Apuntes del equipo sobre esta persona. Solo el equipo las ve; ni el cliente ni el compita. Cada nota guarda quién la escribió y cuándo, y no se puede editar ni borrar." /></div>
          {puedeNotas && (
            <div className="space-y-2">
              {falloNota && <Aviso tamano="compacto" tono="peligro">{falloNota}</Aviso>}
              <textarea aria-label="Escribe una nota" value={borrador} maxLength={MAX_NOTA} onChange={(e) => setBorrador(e.target.value)} placeholder="Escribe una nota. Por ejemplo: prefiere que le escriban por correo." className="min-h-20 w-full rounded-xl border border-borde p-3 text-sm" />
              <div className="flex justify-end"><Boton tamano="compacto" variante="secundario" info="Guarda la nota con tu nombre y la fecha. Solo la ve el equipo y no se puede editar ni borrar después." disabled={!borrador.trim()} cargando={guardando} onClick={guardarNota}>Guardar nota</Boton></div>
            </div>
          )}
          {notas.length === 0 ? <p className="text-sm text-texto-sutil">Todavía no hay notas.</p> : (
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id} className="rounded-xl bg-fondo-claro px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{n.texto}</p>
                  <p className="mt-1 text-xs text-texto-sutil">{n.autor} · {cuandoLinea(n.creado_en)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-texto-sutil">Solo el equipo ve esta ficha. Cliente y compita nunca ven el contacto del otro.</p>
      </aside>
      {pidiendo && <MotivoDialog titulo={`¿Por qué necesitas ${pidiendo === 'correo' ? 'el correo' : pidiendo === 'telefono' ? 'el teléfono' : 'el WhatsApp'}?`} texto="Es un dato sensible. Queda anotado junto con tu nombre." onListo={(m) => pedir(pidiendo, m)} onCancelar={() => setPidiendo(null)} />}
    </div>
  )
}
