'use client'

import { useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'
import { PERMISOS, PERMISOS_BASE, ETIQUETA_PERMISO, type Permiso } from '@/lib/permisos-catalogo'
import type { Colaborador } from '@/lib/equipo'

type Activados = Record<string, boolean>
const activos = (p: Record<string, unknown>): Activados => Object.fromEntries(PERMISOS.map((k) => [k, p[k] === true]))
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'medium' })

type Respuesta = { ok?: boolean; data?: Colaborador; error?: string }
async function llamar(metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<{ ok: true; data: Colaborador } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/admin/equipo', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const b = (await res.json().catch(() => null)) as Respuesta | null
    if (!res.ok || !b?.ok || !b.data) return { ok: false, error: b?.error ?? 'No se pudo guardar' }
    return { ok: true, data: b.data }
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo.' }
  }
}

const boton = (primario: boolean, apagado = false) => ({
  minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.md, fontFamily: fonts.display, fontWeight: 700, fontSize: '14px', cursor: apagado ? 'not-allowed' : 'pointer', opacity: apagado ? 0.5 : 1,
  border: primario ? 'none' : `2px solid ${colors.moradoProfundo}`, background: primario ? colors.naranja : colors.blanco, color: primario ? colors.blanco : colors.moradoProfundo,
})
const campo = { width: '100%', boxSizing: 'border-box' as const, minHeight: '44px', border: `1px solid ${colors.gris200}`, borderRadius: radius.sm, padding: `0 ${spacing.sm}`, fontSize: '14px', fontFamily: fonts.body, color: colors.textoOscuro, background: colors.blanco }

function Interruptor({ encendido, etiqueta, deshabilitado, onCambio }: { encendido: boolean; etiqueta: string; deshabilitado?: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: '44px', cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? 0.6 : 1 }}>
      <input type="checkbox" role="switch" checked={encendido} disabled={deshabilitado} onChange={(e) => onCambio(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: colors.naranja, flexShrink: 0 }} />
      <span style={{ fontSize: '14px', color: colors.textoOscuro }}>{etiqueta}</span>
    </label>
  )
}

export default function EquipoPanel({ inicial, administradores }: { inicial: Colaborador[]; administradores: string[] }) {
  const [equipo, setEquipo] = useState<Colaborador[]>(inicial)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const reemplazar = (c: Colaborador) => setEquipo((e) => e.map((x) => (x.correo === c.correo ? c : x)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {aviso && (
        <div role="status" style={{ background: aviso.tipo === 'ok' ? colors.verdeClaro : colors.rojoClaro, color: aviso.tipo === 'ok' ? colors.verde : colors.rojo, borderRadius: radius.md, padding: spacing.md, fontSize: '14px', fontWeight: 600 }}>
          {aviso.texto}
        </div>
      )}

      <section>
        <h2 style={{ fontFamily: fonts.display, fontSize: '18px', color: colors.textoOscuro, margin: `0 0 ${spacing.sm}` }}>Colaboradores ({equipo.length})</h2>
        {equipo.length === 0 && (
          <div style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md, color: colors.textoMedio, fontSize: '14px' }}>
            Todavía no hay colaboradores. Invita al primero abajo.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {equipo.map((c) => <Tarjeta key={c.correo} c={c} onCambio={reemplazar} onAviso={setAviso} />)}
        </div>
      </section>

      <Invitar onCreado={(c) => { setEquipo((e) => [...e, c]); setAviso({ tipo: 'ok', texto: `${c.nombre} ya está en el equipo. Entra con su correo ${c.correo}.` }) }} onError={(t) => setAviso({ tipo: 'error', texto: t })} />

      <section style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: '18px', color: colors.textoOscuro, margin: `0 0 ${spacing.sm}` }}>Administradores (acceso total)</h2>
        <ul style={{ margin: `0 0 ${spacing.sm}`, paddingLeft: '20px', color: colors.textoOscuro, fontSize: '14px', lineHeight: 1.8 }}>
          {administradores.map((a) => <li key={a}>{a}</li>)}
        </ul>
        <p style={{ margin: 0, color: colors.textoMedio, fontSize: '13px', lineHeight: 1.6 }}>
          Esta lista no se cambia desde el panel a propósito: así nadie con una sesión robada puede darse acceso total. Para agregar o quitar
          a un administrador, edita ADMIN_EMAILS en Netlify y vuelve a desplegar.
        </p>
      </section>
    </div>
  )
}

function Tarjeta({ c, onCambio, onAviso }: { c: Colaborador; onCambio: (c: Colaborador) => void; onAviso: (a: { tipo: 'ok' | 'error'; texto: string }) => void }) {
  const [guardando, setGuardando] = useState(false)
  const permisos = activos(c.permisos)

  async function guardarPermisos(nuevos: Activados) {
    setGuardando(true)
    const r = await llamar('PATCH', { correo: c.correo, permisos: nuevos })
    setGuardando(false)
    if (r.ok) onCambio(r.data); else onAviso({ tipo: 'error', texto: `${c.nombre}: ${r.error}` })
  }
  async function cambiarActivo(activo: boolean) {
    setGuardando(true)
    const r = await llamar('PATCH', { correo: c.correo, activo })
    setGuardando(false)
    if (r.ok) { onCambio(r.data); onAviso({ tipo: 'ok', texto: activo ? `${c.nombre} puede volver a entrar.` : `${c.nombre} ya no puede entrar al panel.` }) }
    else onAviso({ tipo: 'error', texto: `${c.nombre}: ${r.error}` })
  }

  return (
    <article style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md, opacity: c.activo ? 1 : 0.75 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }}>
        <div style={{ minWidth: '220px' }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, color: colors.textoOscuro, fontSize: '16px' }}>
            {c.nombre} {!c.activo && <span style={{ fontSize: '12px', background: colors.gris100, color: colors.gris600, borderRadius: radius.pill, padding: '2px 8px', marginLeft: '6px' }}>Sin acceso</span>}
          </div>
          <div style={{ color: colors.textoMedio, fontSize: '13px', marginTop: '2px', wordBreak: 'break-all' }}>{c.correo} · desde {fecha(c.creado_en)}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' }}>
          <button type="button" disabled={guardando || !c.activo} onClick={() => guardarPermisos({ ...PERMISOS_BASE })} style={boton(false, guardando || !c.activo)}>Dejar los recomendados</button>
          <button type="button" disabled={guardando} onClick={() => cambiarActivo(!c.activo)} style={boton(false, guardando)}>{c.activo ? 'Quitar acceso' : 'Devolver acceso'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', columnGap: spacing.md, marginTop: spacing.sm }}>
        {PERMISOS.map((p: Permiso) => (
          <Interruptor key={p} encendido={permisos[p]} etiqueta={ETIQUETA_PERMISO[p]} deshabilitado={guardando || !c.activo} onCambio={(v) => guardarPermisos({ ...permisos, [p]: v })} />
        ))}
      </div>
    </article>
  )
}

function Invitar({ onCreado, onError }: { onCreado: (c: Colaborador) => void; onError: (t: string) => void }) {
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [permisos, setPermisos] = useState<Activados>({ ...PERMISOS_BASE })
  const [enviando, setEnviando] = useState(false)

  async function invitar() {
    if (!correo.trim() || !nombre.trim() || enviando) return
    setEnviando(true)
    const r = await llamar('POST', { correo, nombre, permisos })
    setEnviando(false)
    if (r.ok) { onCreado(r.data); setCorreo(''); setNombre(''); setPermisos({ ...PERMISOS_BASE }) } else onError(r.error)
  }

  return (
    <section style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: '18px', color: colors.textoOscuro, margin: `0 0 ${spacing.xs}` }}>Invitar a un colaborador</h2>
      <p style={{ margin: `0 0 ${spacing.sm}`, color: colors.textoMedio, fontSize: '13px', lineHeight: 1.6 }}>
        Entra con su correo, igual que los clientes. Los permisos marcados son los recomendados; cámbialos antes de invitar si quieres.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing.sm }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre" maxLength={80} style={campo} />
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo" aria-label="Correo" type="email" style={campo} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', columnGap: spacing.md, marginTop: spacing.sm }}>
        {PERMISOS.map((p: Permiso) => (
          <Interruptor key={p} encendido={permisos[p]} etiqueta={ETIQUETA_PERMISO[p]} onCambio={(v) => setPermisos({ ...permisos, [p]: v })} />
        ))}
      </div>
      <div style={{ marginTop: spacing.sm }}>
        <button type="button" onClick={invitar} disabled={enviando || !correo.trim() || !nombre.trim()} style={boton(true, enviando || !correo.trim() || !nombre.trim())}>
          {enviando ? 'Invitando…' : 'Invitar'}
        </button>
      </div>
    </section>
  )
}
