'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import DialogoPanel from '@/components/panel/DialogoPanel'
import { Rol } from '@/components/panel/ui'
import { ETIQUETA_PERMISO, PERMISOS, PERMISOS_BASE, type Permiso, type PermisosActor } from '@/lib/permisos-catalogo'
import { DETALLE_PERMISO, contarPermisos } from '@/lib/panel-equipo-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'

async function enviar(metodo: 'POST' | 'PATCH' | 'DELETE', cuerpo: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/admin/equipo', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
    return r.ok && j?.ok !== false ? { ok: true } : { ok: false, error: j?.error ?? `Error ${r.status}` }
  } catch { return { ok: false, error: 'Sin conexión. No se guardó nada: inténtalo otra vez.' } }
}

function Interruptor({ activo, etiqueta, onCambia, apagado }: { activo: boolean; etiqueta: string; onCambia: (v: boolean) => void; apagado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={apagado} onClick={() => onCambia(!activo)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${activo ? 'bg-verde-vivo' : 'bg-gris200'}`}>
      <span aria-hidden className={`absolute top-0.5 h-5 w-5 rounded-full bg-blanco shadow transition-all ${activo ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** Un colaborador: sus permisos con interruptores (se guardan al instante), restablecer a lo recomendado y desactivar o reactivar. */
export function TarjetaColaborador({ correo, nombre, activo, permisos, creadoPor, creadoEn }: { correo: string; nombre: string; activo: boolean; permisos: PermisosActor; creadoPor: string; creadoEn: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [p, setP] = useState<PermisosActor>(permisos)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  async function guardar(nuevo: PermisosActor, texto: string) {
    const antes = p
    setP(nuevo); setOcupado(true); setMsg(null)
    const r = await enviar('PATCH', { correo, permisos: nuevo })
    setOcupado(false)
    if (!r.ok) { setP(antes); setMsg({ ok: false, texto: r.error ?? 'No se pudo guardar' }); return }
    setMsg({ ok: true, texto: `✓ ${texto}` }); router.refresh()
  }
  async function cambiarActivo(v: boolean) {
    setOcupado(true); setMsg(null)
    const r = await enviar('PATCH', { correo, activo: v })
    setOcupado(false); setConfirmar(false)
    if (!r.ok) { setMsg({ ok: false, texto: r.error ?? 'No se pudo guardar' }); return }
    router.refresh()
  }

  async function quitar() {
    setOcupado(true); setMsg(null)
    const r = await enviar('DELETE', { correo })
    setOcupado(false)
    if (!r.ok) { setConfirmarQuitar(false); setMsg({ ok: false, texto: r.error ?? 'No se pudo quitar' }); return }
    router.refresh()
  }

  return (
    <li className={activo ? '' : 'bg-fondo-claro'}>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-lavanda-sutil">
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{nombre}</span><span className="block truncate text-xs text-texto-medio">{correo}</span></span>
        {!activo && <span className="rounded bg-rojo-claro px-1.5 text-[11px] font-extrabold text-rojo-oscuro">Desactivado</span>}
        <Rol>{contarPermisos(p)} de {PERMISOS.length} permisos</Rol>
        <span aria-hidden className="text-texto-sutil">{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-borde px-3 pb-3 pt-2">
          {msg && <p role="status" className={`text-sm font-bold ${msg.ok ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{msg.texto}</p>}
          <ul className="divide-y divide-borde">
            {PERMISOS.map((k: Permiso) => (
              <li key={k} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0"><span className="block text-sm font-bold">{ETIQUETA_PERMISO[k]}</span><span className="block text-xs text-texto-medio">{DETALLE_PERMISO[k]}</span></span>
                <Interruptor activo={p[k]} apagado={ocupado || !activo} etiqueta={`${ETIQUETA_PERMISO[k]}, ${nombre}`} onCambia={(v) => guardar({ ...p, [k]: v }, `${v ? 'Activaste' : 'Apagaste'} "${ETIQUETA_PERMISO[k]}" para ${nombre}`)} />
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-2 opacity-70"><span><span className="block text-sm font-bold">Gestionar el equipo y sus permisos</span><span className="block text-xs text-texto-medio">Solo los administradores pueden hacerlo, nunca un colaborador.</span></span><span className="text-xs font-bold text-texto-sutil">No disponible</span></li>
          </ul>
          <p className="text-xs text-texto-sutil">Agregado por {creadoPor} · {cuandoLinea(creadoEn)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Boton tamano="compacto" variante="secundario" info="Deja los permisos como se recomiendan para un colaborador nuevo (ver Bandeja, personas, chats y teléfonos con motivo; sin pagos, cuentas ni cambiar ajustes). Queda en el historial." disabled={ocupado || !activo} onClick={() => guardar({ ...PERMISOS_BASE } as PermisosActor, `Los permisos de ${nombre} volvieron a lo recomendado`)}>Restablecer a lo recomendado</Boton>
            {activo
              ? <Boton tamano="compacto" variante="peligro" info="Le corta el acceso al panel ahora mismo. Sus permisos se conservan por si lo reactivas. Queda en el historial." disabled={ocupado} onClick={() => setConfirmar(true)}>Desactivar</Boton>
              : <Boton tamano="compacto" variante="primario" info="Le devuelve el acceso con los permisos que tenía. Queda en el historial." cargando={ocupado} onClick={() => cambiarActivo(true)}>Reactivar</Boton>}
            <Boton tamano="compacto" variante="peligro" info="Quita a esta persona del equipo para siempre: pierde el acceso y se borran sus permisos. Si luego la necesitas, hay que invitarla de nuevo. Lo que hizo y este cambio quedan en el historial. Si solo quieres pausarla, usa Desactivar." disabled={ocupado} onClick={() => setConfirmarQuitar(true)}>Quitar del equipo</Boton>
          </div>
        </div>
      )}
      {confirmarQuitar && (
        <DialogoPanel titulo={`¿Quitar a ${nombre} del equipo?`} onCerrar={() => setConfirmarQuitar(false)}>
          <p className="mt-1 text-sm text-texto-medio">Pierde el acceso en este momento y se borran sus permisos. Si luego lo necesitas, hay que invitarlo de nuevo. Lo que hizo (tareas, accesos y notas) se conserva, y este cambio queda en el historial. Si solo quieres pausarlo, usa Desactivar.</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setConfirmarQuitar(false)}>Cancelar</Boton>
            <Boton tamano="compacto" variante="peligro" info="Quita a esta persona del equipo ahora mismo. No se puede deshacer, salvo invitándola otra vez." cargando={ocupado} onClick={quitar}>Sí, quitar del equipo</Boton>
          </div>
        </DialogoPanel>
      )}
      {confirmar && (
        <DialogoPanel titulo={`¿Desactivar a ${nombre}?`} onCerrar={() => setConfirmar(false)}>
          <p className="mt-1 text-sm text-texto-medio">Pierde el acceso al panel en este momento. Sus permisos se conservan y puedes reactivarlo cuando quieras. Queda anotado en el historial.</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setConfirmar(false)}>Cancelar</Boton>
            <Boton tamano="compacto" variante="peligro" info="Corta el acceso de esta persona de inmediato." cargando={ocupado} onClick={() => cambiarActivo(false)}>Sí, desactivar</Boton>
          </div>
        </DialogoPanel>
      )}
    </li>
  )
}

/** Invitar a alguien al equipo con los permisos recomendados. No manda ningún correo: cuando entre con ese correo verá el panel. */
export function InvitarColaborador() {
  const router = useRouter()
  const [correo, setCorreo] = useState(''); const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const valido = /^\S+@\S+\.\S+$/.test(correo.trim()) && nombre.trim().length >= 2
  async function invitar() {
    setCargando(true); setMsg(null)
    const r = await enviar('POST', { correo: correo.trim(), nombre: nombre.trim(), permisos: PERMISOS_BASE })
    setCargando(false)
    if (!r.ok) { setMsg({ ok: false, texto: r.error ?? 'No se pudo invitar' }); return }
    setMsg({ ok: true, texto: `✓ ${nombre.trim()} ya está en el equipo con los permisos recomendados. Avísale tú: no se le manda ningún correo.` }); setCorreo(''); setNombre(''); router.refresh()
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre del colaborador" maxLength={80} className="min-h-10 w-full rounded-xl border border-borde bg-blanco px-3 text-sm sm:w-48" />
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} inputMode="email" placeholder="correo@ejemplo.com" aria-label="Correo del colaborador" className="min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-blanco px-3 text-sm" />
        <Boton tamano="compacto" info="Agrega a esa persona al equipo con los permisos recomendados (ajústalos después con los interruptores). No le manda ningún correo: cuando entre con ese correo, verá el panel." disabled={!valido} cargando={cargando} onClick={invitar}>Invitar</Boton>
      </div>
      {msg && (msg.ok ? <p role="status" className="text-sm font-bold text-verde-oscuro">{msg.texto}</p> : <Aviso tamano="compacto" tono="peligro">{msg.texto}</Aviso>)}
    </div>
  )
}
