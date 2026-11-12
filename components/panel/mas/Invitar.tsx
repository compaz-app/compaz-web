'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { Encabezado, TituloSeccion } from '@/components/panel/ui'
import FormCompita from '@/components/panel/FormCompita'

const INFO = 'Para sumar personas sin que se registren solas. A un cliente se le crea la cuenta y recibe un correo con su enlace de acceso. Para un compita se genera un enlace de registro que dura 7 días y que tú le mandas. Si el cliente ya está registrado no se le reinvita: que pida un enlace nuevo en la página de entrada.'
const CAMPO = 'min-h-9 w-full rounded-lg border border-borde bg-blanco px-2 text-sm'

// Invitar: un cliente por correo, o un enlace de registro para un compita. Las rutas piden el permiso "invitar" en el servidor.
export default function Invitar() {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [enlace, setEnlace] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [falloEnlace, setFalloEnlace] = useState('')

  async function invitarCliente() {
    setCargando(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/invitar-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), email: correo.trim() }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setMsg({ ok: false, texto: j?.error ?? `Error ${r.status}` }); return }
      setMsg({ ok: true, texto: `Invitación enviada a ${correo.trim()}.` }); setNombre(''); setCorreo('')
    } catch { setMsg({ ok: false, texto: 'Sin conexión. No se envió nada: inténtalo otra vez.' }) } finally { setCargando(false) }
  }

  async function generarEnlace() {
    setGenerando(true); setFalloEnlace(''); setCopiado(false)
    try {
      const r = await fetch('/api/admin/generar-invite', { method: 'POST' })
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: { url?: string }; error?: string } | null
      if (!r.ok || !j?.data?.url) { setFalloEnlace(j?.error ?? `Error ${r.status}`); return }
      setEnlace(j.data.url)
    } catch { setFalloEnlace('Sin conexión: inténtalo otra vez.') } finally { setGenerando(false) }
  }

  return (
    <section className="max-w-3xl space-y-4">
      <Encabezado titulo="Invitar" descripcion="Suma a un cliente o a un compita sin que se registre solo." info={INFO} infoQue="Cómo funciona invitar" />

      <div className="space-y-2">
        <TituloSeccion>Invitar a un cliente</TituloSeccion>
        <div className="grid gap-2 rounded-xl border border-borde bg-blanco p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs text-texto-medio">Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} disabled={cargando} className={`${CAMPO} mt-1`} />
          </label>
          <label className="text-xs text-texto-medio">Correo
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={cargando} className={`${CAMPO} mt-1`} />
          </label>
          <Boton tamano="compacto" cargando={cargando} disabled={!nombre.trim() || !correo.trim()} onClick={invitarCliente} info="Crea su cuenta y le envía por correo el enlace para entrar. Si ya está registrado, no se le reinvita.">Enviar invitación</Boton>
        </div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-bold ${msg.ok ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{msg.texto}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>Enlace de registro para un compita</TituloSeccion><InfoBoton que="Qué es esto" texto="Genera un enlace de un solo uso, válido 7 días, que lleva al formulario de registro del compita. Tú se lo mandas por el canal que prefieras." /></div>
        <div className="space-y-2 rounded-xl border border-borde bg-blanco p-3">
          <Boton tamano="compacto" variante="secundario" cargando={generando} onClick={generarEnlace} info="Crea un enlace nuevo de registro de compita, válido 7 días. Cada vez que lo pulsas se crea uno distinto.">Generar enlace</Boton>
          {enlace && (
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={enlace} aria-label="Enlace de registro" onFocus={(e) => e.currentTarget.select()} className={`${CAMPO} min-w-56 flex-1`} />
              <Boton tamano="compacto" variante="secundario" info="Copia el enlace para pegarlo en un mensaje." onClick={async () => { try { await navigator.clipboard.writeText(enlace); setCopiado(true) } catch { /* sin permiso: se puede copiar a mano */ } }}>{copiado ? 'Copiado' : 'Copiar'}</Boton>
            </div>
          )}
          {falloEnlace && <p role="alert" className="text-sm font-bold text-rojo-oscuro">{falloEnlace}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>Registrar un compita a mano</TituloSeccion><InfoBoton que="Cuándo usarlo" texto="Para dar de alta a un compita cuando ya tienes sus datos (por ejemplo, tras una entrevista) sin esperar a que llene el formulario. Queda inactivo y sin verificar: verifícalo y actívalo desde su ficha en Personas. Si pones su correo, recibe la bienvenida." /></div>
        <div className="rounded-xl border border-borde bg-blanco p-3"><FormCompita modo="registrar" /></div>
      </div>
    </section>
  )
}
