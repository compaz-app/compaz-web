'use client'

import { useEffect, useRef, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import DialogoPanel from '@/components/panel/DialogoPanel'
import MotivoDialog from '@/components/panel/MotivoDialog'
import { OPCIONES_DECISION, OPCIONES_LLAMADA, type AccionTarea as Accion, type ReporteLlamada, type TareaBandeja } from '@/lib/panel-bandeja-tipos'
import { cuandoLinea, digitosWhatsapp } from '@/lib/panel-personas-tipos'

async function enviar(url: string, metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: string } | null
    return r.ok && j?.ok !== false ? { ok: true, data: j?.data } : { ok: false, error: j?.error ?? `Error ${r.status}` }
  } catch { return { ok: false, error: 'Sin conexión. No se perdió nada: inténtalo otra vez.' } }
}

function Opciones<T extends string>({ opciones, valor, onElige }: { opciones: readonly { id: T; t: string; d: string }[]; valor: T | ''; onElige: (v: T) => void }) {
  return (
    <div className="mt-3 grid gap-1.5">
      {opciones.map((o) => (
        <div key={o.id} className="flex items-center gap-1">
          <button type="button" onClick={() => onElige(o.id)} aria-pressed={valor === o.id} className={`min-h-11 flex-1 rounded-xl border px-3 py-1.5 text-left ${valor === o.id ? 'border-morado-medio bg-lavanda-sutil' : 'border-borde'}`}>
            <span className="block text-sm font-extrabold">{o.t}</span>
          </button>
          <InfoBoton que={o.t} texto={o.d} />
        </div>
      ))}
    </div>
  )
}

function DialogoPago({ tarea, monto, onCerrar, onHecho }: { tarea: TareaBandeja; monto: number | null; onCerrar: () => void; onHecho: () => void }) {
  const [cargando, setCargando] = useState(false); const [fallo, setFallo] = useState<string | null>(null)
  async function confirmar() {
    setCargando(true); setFallo(null)
    const r = await enviar('/api/admin/confirmar-pago', 'POST', { flag_id: tarea.id })
    setCargando(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo confirmar'); return }
    onHecho()
  }
  return (
    <DialogoPanel titulo="¿Ya llegó el dinero?" onCerrar={onCerrar}>
      <p className="mt-1 text-sm text-texto-medio">Vas a confirmar el pago{monto ? ` de $${monto}` : ''} de <b>{tarea.entidad_nombre || 'este cliente'}</b>. El cliente podrá completar su ficha y agendar, y le llega un correo. Queda anotado que lo confirmaste tú.</p>
      {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Boton tamano="compacto" variante="fantasma" navegacion onClick={onCerrar}>Cancelar</Boton>
        <Boton tamano="compacto" info="Confirma el pago, avisa al cliente por correo y cierra las tareas de pago de ese cliente. Revisa que el dinero de verdad llegó antes de confirmar." cargando={cargando} onClick={confirmar}>Sí, confirmar pago</Boton>
      </div>
    </DialogoPanel>
  )
}

function DialogoDecision({ accion, onCerrar, onHecho }: { accion: Extract<Accion, { tipo: 'decidir' }>; onCerrar: () => void; onHecho: () => void }) {
  const p = accion.pausa
  const [sel, setSel] = useState<'' | 'reactivar' | 'otra_oportunidad' | 'bloquear'>('')
  const [cargando, setCargando] = useState(false); const [fallo, setFallo] = useState<string | null>(null)
  async function confirmar() {
    setCargando(true); setFallo(null)
    const r = await enviar('/api/admin/pausas', 'PATCH', { id: p.id, decision: sel })
    setCargando(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo registrar la decisión'); return }
    onHecho()
  }
  return (
    <DialogoPanel titulo={p.rol === 'compita' ? '¿Qué hacemos con el compita?' : '¿Qué hacemos con la cuenta?'} onCerrar={onCerrar}>
      <p className="mt-1 text-sm text-texto-medio"><b>{p.nombre || 'Esta persona'}</b> está en pausa por compartir contactos{p.reincidente ? ' (ya había pasado antes)' : ''}. Tiene {p.visitas_abiertas} {p.visitas_abiertas === 1 ? 'visita abierta' : 'visitas abiertas'}. Antes de decidir puedes revisar su chat desde la ficha. Tu decisión queda anotada.</p>
      <Opciones opciones={OPCIONES_DECISION} valor={sel} onElige={setSel} />
      {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Boton tamano="compacto" variante="fantasma" navegacion onClick={onCerrar}>Cancelar</Boton>
        <Boton tamano="compacto" info="Aplica tu decisión, avisa a la persona y cierra la tarea. Si eliges bloquear, el bloqueo se aplica de verdad." disabled={!sel} cargando={cargando} onClick={confirmar}>Confirmar decisión</Boton>
      </div>
    </DialogoPanel>
  )
}

function DialogoLlamada({ reporte, onCerrar, onHecho }: { reporte: ReporteLlamada; onCerrar: () => void; onHecho: () => void }) {
  const [sel, setSel] = useState<'' | 'resuelto' | 'hablar_cliente' | 'mantener_bloqueo' | 'levantar_bloqueo'>('')
  const [abiertas, setAbiertas] = useState(reporte.abiertas)
  const [cargando, setCargando] = useState(false); const [fallo, setFallo] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const cancelables = abiertas.visitas.filter((v) => v.cancelable).length + abiertas.solicitudes.length
  const enVivo = abiertas.visitas.filter((v) => !v.cancelable).length

  async function cancelar() {
    setCargando(true); setFallo(null); setMsg(null)
    const r = await enviar('/api/admin/reportes-compita', 'POST', { id: reporte.id })
    setCargando(false); setConfirmarCancelar(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo cancelar'); return }
    setAbiertas({ visitas: abiertas.visitas.filter((v) => !v.cancelable), solicitudes: [] })
    setMsg(`Listo: ${r.data?.visitas ?? 0} visita(s) y ${r.data?.solicitudes ?? 0} solicitud(es) canceladas y el cliente avisado.`)
  }
  async function registrar() {
    setCargando(true); setFallo(null)
    const r = await enviar('/api/admin/reportes-compita', 'PATCH', { id: reporte.id, resultado: sel })
    setCargando(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo registrar la llamada'); return }
    onHecho()
  }
  return (
    <DialogoPanel titulo={`Llamada a ${reporte.compita_nombre}`} onCerrar={onCerrar}>
      <div className="mt-2"><Aviso tamano="compacto" tono={reporte.vencido ? 'peligro' : 'advertencia'}>{reporte.vencido ? 'Plazo vencido: era antes del' : 'Llamar antes del'} {cuandoLinea(reporte.plazo_llamada)} · si pasa sin llamada, el sistema te vuelve a avisar.</Aviso></div>
      <p className="mt-2 text-sm text-texto-medio">Reporte sobre <b>{reporte.cliente_nombre}</b>: {reporte.motivo}. No le pidas datos por teléfono; escucha y decide.</p>
      {(cancelables > 0 || enVivo > 0) && (
        <div className="mt-3 rounded-xl border border-borde p-3 text-sm">
          <p className="font-bold">Sigue abierto con este cliente</p>
          <p className="text-texto-medio">{abiertas.visitas.length} {abiertas.visitas.length === 1 ? 'visita' : 'visitas'} y {abiertas.solicitudes.length} {abiertas.solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}.{enVivo > 0 ? ' Una visita ya empezó: esa se atiende aparte, no se cancela desde aquí.' : ''}</p>
          {cancelables > 0 && (
            <div className="mt-2">
              {confirmarCancelar ? (
                <div className="space-y-2">
                  <p className="text-xs text-texto-medio">Se cancelarán las visitas y solicitudes abiertas entre este compita y este cliente. Al cliente se le devuelve el crédito y se le avisa, sin decirle el motivo.</p>
                  <div className="flex items-center gap-2"><Boton tamano="compacto" variante="peligro" info="Cancela de verdad lo abierto entre ambos y avisa al cliente sin decirle el motivo. No se puede deshacer." cargando={cargando} onClick={cancelar}>Sí, cancelar</Boton><Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setConfirmarCancelar(false)}>No</Boton></div>
                </div>
              ) : <Boton tamano="compacto" variante="peligro" info="Cancela las visitas y solicitudes que siguen abiertas entre este compita y este cliente. Al cliente se le devuelve el crédito y recibe un aviso neutro, sin el motivo." onClick={() => setConfirmarCancelar(true)}>Cancelar y avisar al cliente</Boton>}
            </div>
          )}
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-sm font-bold text-verde-oscuro">{msg}</p>}
      <p className="mt-3 text-sm font-bold text-texto-medio">Después de llamar, registra qué decidiste:</p>
      <Opciones opciones={OPCIONES_LLAMADA} valor={sel} onElige={setSel} />
      {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Boton tamano="compacto" variante="fantasma" navegacion onClick={onCerrar}>Cerrar</Boton>
        <Boton tamano="compacto" info="Guarda quién llamó, cuándo y qué decidiste, y cierra la tarea. Si levantas el bloqueo, el cliente vuelve a poder pedirle visitas a este compita." disabled={!sel} cargando={cargando} onClick={registrar}>Registrar</Boton>
      </div>
    </DialogoPanel>
  )
}

/** Contactar al sitio: el nombre y el teléfono de quien debe abrir la puerta. Un colaborador da un motivo primero; queda anotado en Actividad. */
function DialogoSitio({ visitaId, pideMotivo, onCerrar }: { visitaId: string; pideMotivo: boolean; onCerrar: () => void }) {
  const [preguntar, setPreguntar] = useState(pideMotivo)
  const [cargando, setCargando] = useState(!pideMotivo); const [fallo, setFallo] = useState<string | null>(null)
  const [dato, setDato] = useState<{ valor: string; detalle: string | null } | null>(null)
  const pedido = useRef(false)
  async function pedir(motivo?: string) {
    setPreguntar(false); setCargando(true); setFallo(null)
    const r = await enviar('/api/admin/contacto', 'POST', { tipo: 'visita', id: visitaId, canal: 'telefono', motivo })
    setCargando(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo mostrar el contacto'); return }
    setDato({ valor: r.data.valor, detalle: r.data.detalle ?? null })
  }
  // El administrador entra directo, una sola vez por apertura (el servidor lo anota).
  useEffect(() => { if (!pideMotivo && !pedido.current) { pedido.current = true; void pedir() } }, [pideMotivo]) // eslint-disable-line react-hooks/exhaustive-deps
  if (preguntar) return <MotivoDialog titulo="¿Por qué necesitas el contacto del sitio?" texto="Es el teléfono de la persona que debe abrir la puerta. Queda anotado junto con tu nombre." onListo={pedir} onCancelar={onCerrar} />
  return (
    <DialogoPanel titulo="Contacto en el sitio" onCerrar={onCerrar}>
      {cargando && <p className="mt-2 text-sm text-texto-medio">Un momento…</p>}
      {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
      {dato && (
        <div className="mt-2 space-y-3">
          <p className="text-sm">{dato.detalle ? <b>{dato.detalle}</b> : 'Contacto en el sitio'}<span className="block text-lg font-extrabold">{dato.valor}</span></p>
          <p className="text-xs text-texto-sutil">Escríbele por WhatsApp o llámalo. No le des datos del compita. Quedó anotado en Actividad.</p>
          <Boton tamano="compacto" variante="secundario" href={`https://wa.me/${digitosWhatsapp(dato.valor)}`} info="Abre WhatsApp para escribirle a esta persona. Compaz no guarda la conversación.">Escribir por WhatsApp</Boton>
        </div>
      )}
      <div className="mt-4 flex justify-end"><Boton tamano="compacto" variante="fantasma" navegacion onClick={onCerrar}>Cerrar</Boton></div>
    </DialogoPanel>
  )
}

/** El botón principal de una tarea según su tipo. Al terminar, avisa a la Bandeja con `onHecho` para que la quite de la lista. */
export default function AccionTarea({ tarea, cerrando, onCerrar, onHecho, onRefrescar, pideMotivo }: { tarea: TareaBandeja; cerrando: boolean; onCerrar: () => void; onHecho: () => void; onRefrescar: () => void; pideMotivo: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [insistiendo, setInsistiendo] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const a = tarea.accion
  if (!a || a.tipo === 'cerrar') {
    const texto = a?.texto ?? 'Marcar atendida'
    return <Boton tamano="compacto" variante="primario" info={a?.info ?? 'Marca la tarea como atendida y la quita de la bandeja. Queda anotado quién la resolvió.'} queHace={texto} cargando={cerrando} onClick={onCerrar}>{texto}</Boton>
  }
  if (a.tipo === 'bloqueada') return <Boton tamano="compacto" variante="secundario" info={a.motivo} queHace={a.texto} disabled>{a.texto}</Boton>
  if (a.tipo === 'insistir') {
    // Insistir no resuelve la tarea: reenvía el aviso y la tarea sigue abierta (con un tope, explicado si se alcanza).
    const insistir = async () => {
      setInsistiendo(true); setMensaje(null)
      const r = await enviar('/api/admin/insistir-aviso', 'POST', { flag_id: tarea.id })
      setInsistiendo(false)
      if (r.ok) { setMensaje({ ok: true, texto: `Aviso reenviado (${r.data?.reenvios ?? 1} de 3).` }); onRefrescar() } else setMensaje({ ok: false, texto: r.error ?? 'No se pudo reenviar' })
    }
    return (
      <div className="flex flex-col items-start gap-1 @lg:items-end">
        <Boton tamano="compacto" variante="primario" info={a.info} queHace={a.texto} cargando={insistiendo} onClick={insistir}>{a.texto}</Boton>
        {a.reenvios > 0 && !mensaje && <span className="text-[11px] text-texto-sutil">Ya insististe {a.reenvios} {a.reenvios === 1 ? 'vez' : 'veces'}</span>}
        {mensaje && <span role="status" className={`text-xs font-bold ${mensaje.ok ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{mensaje.texto}</span>}
      </div>
    )
  }
  const cerrar = () => setAbierto(false)
  const hecho = () => { setAbierto(false); onHecho() }
  return (
    <>
      <Boton tamano="compacto" variante="primario" info={a.info} queHace={a.texto} onClick={() => setAbierto(true)}>{a.texto}</Boton>
      {abierto && a.tipo === 'pago' && <DialogoPago tarea={tarea} monto={a.monto} onCerrar={cerrar} onHecho={hecho} />}
      {abierto && a.tipo === 'decidir' && <DialogoDecision accion={a} onCerrar={cerrar} onHecho={hecho} />}
      {abierto && a.tipo === 'llamada' && <DialogoLlamada reporte={a.reporte} onCerrar={cerrar} onHecho={hecho} />}
      {abierto && a.tipo === 'sitio' && <DialogoSitio visitaId={a.visitaId} pideMotivo={pideMotivo} onCerrar={cerrar} />}
    </>
  )
}
