'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'

const CAMPO = 'min-h-9 w-full rounded-lg border border-borde bg-blanco px-2 text-sm'
export interface PerfilCompita { zona: string; descripcion: string; servicios: string[]; youtube: string; fotoUrl: string | null }

// El perfil de un compita: se usa para registrarlo a mano (modo "registrar") y para corregir su perfil desde la ficha (modo "editar"). Las rutas
// piden el permiso en el servidor. Un compita registrado a mano queda inactivo y sin verificar: se activa después desde su ficha.
export default function FormCompita({ modo, id, inicial, onListo }: { modo: 'registrar' | 'editar'; id?: string; inicial?: PerfilCompita; onListo?: () => void }) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState(inicial?.zona ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [servicios, setServicios] = useState((inicial?.servicios ?? []).join(', '))
  const [youtube, setYoutube] = useState(inicial?.youtube ?? '')
  const [foto, setFoto] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const lista = servicios.split(',').map((x) => x.trim()).filter(Boolean)
  const completo = zona.trim() && descripcion.trim() && lista.length > 0 && (modo === 'editar' || nombre.trim().length >= 2)

  async function subirFoto(): Promise<string | null> {
    if (!foto) return null
    const f = new FormData(); f.append('foto', foto); f.append('nombre', nombre || 'compita')
    const r = await fetch('/api/admin/upload-foto', { method: 'POST', body: f })
    const j = await r.json().catch(() => null) as { ok?: boolean; data?: { url?: string }; error?: string } | null
    if (!r.ok || !j?.data?.url) throw new Error(j?.error ?? 'No se pudo subir la foto')
    return j.data.url
  }

  async function guardar() {
    setCargando(true); setMsg(null)
    try {
      const url = await subirFoto()
      const perfil = { zona: zona.trim(), descripcion: descripcion.trim(), servicios: lista, youtube_url: youtube.trim() || null, ...(url ? { foto_url: url } : {}) }
      const r = modo === 'registrar'
        ? await fetch('/api/admin/registrar-compita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...perfil, nombre: nombre.trim(), apellido: apellido.trim() || undefined, email: correo.trim() || undefined, telefono: telefono.trim() || undefined }) })
        : await fetch('/api/admin/compita', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...perfil }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setMsg({ ok: false, texto: j?.error ?? `Error ${r.status}` }); return }
      setMsg({ ok: true, texto: modo === 'registrar' ? 'Compita registrado. Queda inactivo y sin verificar: actívalo desde su ficha en Personas.' : 'Perfil actualizado.' })
      if (modo === 'registrar') { setNombre(''); setApellido(''); setCorreo(''); setTelefono(''); setZona(''); setDescripcion(''); setServicios(''); setYoutube(''); setFoto(null) }
      router.refresh(); onListo?.()
    } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Sin conexión. No se guardó nada: inténtalo otra vez.' }) } finally { setCargando(false) }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {modo === 'registrar' && (
          <>
            <label className="text-xs text-texto-medio">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} disabled={cargando} className={`${CAMPO} mt-1`} /></label>
            <label className="text-xs text-texto-medio">Apellido (opcional)<input value={apellido} onChange={(e) => setApellido(e.target.value)} maxLength={80} disabled={cargando} className={`${CAMPO} mt-1`} /></label>
            <label className="text-xs text-texto-medio">Correo (opcional)<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={cargando} className={`${CAMPO} mt-1`} /></label>
            <label className="text-xs text-texto-medio">Teléfono con código de país (opcional)<input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+58 412 123 4567" disabled={cargando} className={`${CAMPO} mt-1`} /></label>
          </>
        )}
        <label className="text-xs text-texto-medio">Zona<input value={zona} onChange={(e) => setZona(e.target.value)} maxLength={100} disabled={cargando} className={`${CAMPO} mt-1`} /></label>
        <label className="text-xs text-texto-medio">Video de YouTube (opcional)<input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtu.be/..." disabled={cargando} className={`${CAMPO} mt-1`} /></label>
      </div>
      <label className="block text-xs text-texto-medio">Servicios, separados por comas
        <input value={servicios} onChange={(e) => setServicios(e.target.value)} placeholder="Compañía, paseos, mandados" disabled={cargando} className={`${CAMPO} mt-1`} />
      </label>
      <label className="block text-xs text-texto-medio">Descripción
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} disabled={cargando} className="mt-1 min-h-24 w-full rounded-lg border border-borde bg-blanco p-2 text-sm" />
      </label>
      <label className="block text-xs text-texto-medio">Foto (JPG, PNG o WEBP, máximo 5 MB){modo === 'editar' && inicial?.fotoUrl ? ' · ya tiene una; elige otra solo para cambiarla' : ''}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} disabled={cargando} className="mt-1 block w-full text-sm" />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-bold ${msg.ok ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{msg.texto}</p>}
      <div className="flex justify-end">
        <Boton tamano="compacto" cargando={cargando} disabled={!completo} onClick={guardar} info={modo === 'registrar' ? 'Crea el perfil del compita. Queda inactivo y sin verificar hasta que lo actives desde su ficha. Si pusiste correo, se le envía la bienvenida.' : 'Guarda los cambios del perfil. Se ven de inmediato en su perfil público.'}>{modo === 'registrar' ? 'Registrar compita' : 'Guardar perfil'}</Boton>
      </div>
    </div>
  )
}
