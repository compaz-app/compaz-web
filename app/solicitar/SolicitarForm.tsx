'use client'

import InfoBoton from '@/components/ui/InfoBoton'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { colors, fonts, spacing, radius } from '@/lib/design'
import { detectarContacto } from '@/lib/detectar-contacto'
import { QUE_OPCIONES, TIPOS_PERSONA, DURACIONES_MANDADO_MIN, MAX_NOTA } from '@/lib/validar-solicitud'

type Modo = 'entrevista' | 'directa' | 'mandado'
const MODOS: { id: Modo; titulo: string; detalle: (c: string, precio: number) => string }[] = [
  { id: 'entrevista', titulo: 'Hablar primero', detalle: (c) => `Una videollamada de 20 minutos antes de decidir. ${c} acepta y tú eliges una de sus horas libres.` },
  { id: 'directa', titulo: 'Contratarlo directo', detalle: (c) => `Sin entrevista. ${c} acepta y tú pagas.` },
  { id: 'mandado', titulo: 'Mandado', detalle: (_c, p) => `Una diligencia puntual, tarifa plana de $${p}.` },
]
const etiquetaDuracion = (m: number) => (m === 60 ? '1 hora' : `${m} minutos`)

const campo = { width: '100%', boxSizing: 'border-box' as const, minHeight: '48px', border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, fontSize: '16px', fontFamily: fonts.body, color: colors.textoOscuro, background: colors.blanco }
const chip = (on: boolean) => ({ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.body, border: on ? 'none' : `1px solid ${colors.gris200}`, background: on ? colors.moradoProfundo : colors.blanco, color: on ? colors.blanco : colors.textoOscuro })

export default function SolicitarForm({ compitaId, compitaNombre, precioMandado, antifraude, familiar, tieneFotoInicial }: { compitaId: string; compitaNombre: string; precioMandado: number; antifraude: string; familiar: string | null; tieneFotoInicial: boolean }) {
  const router = useRouter()
  const sp = useSearchParams()
  const modo: Modo = sp.get('modo') === 'mandado' ? 'mandado' : sp.get('modo') === 'entrevista' ? 'entrevista' : 'directa'
  const m = MODOS.find((x) => x.id === modo)!
  const esMandado = modo === 'mandado'

  const [que, setQue] = useState('')
  const [nota, setNota] = useState('')
  const [duracion, setDuracion] = useState<number | null>(null)
  const [privado, setPrivado] = useState<boolean | null>(null)
  const [personas, setPersonas] = useState<string[]>([])
  const [nadie, setNadie] = useState(false)
  const [avisoContacto, setAvisoContacto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [porQueError, setPorQueError] = useState('')
  const [enviada, setEnviada] = useState(false)
  const [tieneFoto, setTieneFoto] = useState(tieneFotoInicial)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')

  // La foto se reduce en el teléfono antes de subirla: pesa poco y sube bien aun con mala conexión.
  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    setSubiendoFoto(true); setErrorFoto('')
    try {
      const img = await createImageBitmap(archivo)
      const escala = Math.min(1, 1000 / Math.max(img.width, img.height))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.round(img.width * escala); lienzo.height = Math.round(img.height * escala)
      lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      const blob: Blob | null = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', 0.82))
      if (!blob) throw new Error('sin imagen')
      const datos = new FormData(); datos.append('foto', blob, 'foto.jpg')
      const r = await fetch('/api/usuario/foto', { method: 'POST', body: datos })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setErrorFoto(d.error ?? 'No pudimos guardar tu foto. Intenta de nuevo.'); return }
      setTieneFoto(true)
    } catch { setErrorFoto('No pudimos leer esa foto. Prueba con otra.') } finally { setSubiendoFoto(false) }
  }
  async function quitarFoto() {
    setSubiendoFoto(true); setErrorFoto('')
    try {
      const r = await fetch('/api/usuario/foto', { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setErrorFoto(d.error ?? 'No pudimos quitar tu foto. Intenta de nuevo.'); return }
      setTieneFoto(false)
    } catch { setErrorFoto('Sin conexión. Intenta de nuevo.') } finally { setSubiendoFoto(false) }
  }

  const principalListo = esMandado ? nota.trim().length > 0 && duracion !== null : !!que
  const personasListas = privado === false || (privado === true && (nadie || personas.length > 0))
  const listo = principalListo && privado !== null && personasListas
  const faltaPersonas = privado === true && !nadie && personas.length === 0 && principalListo

  function cambiarModo(nuevo: Modo) {
    const p = new URLSearchParams(sp.toString())
    p.set('modo', nuevo)
    router.replace(`/solicitar?${p.toString()}`, { scroll: false })
    setAvisoContacto(false); setError('')
  }

  async function enviar() {
    if (!listo || enviando) return
    // Primer aviso amable ANTES de enviar. Si lo envía igual, el servidor lo censura y cuenta la detección.
    if (!avisoContacto && detectarContacto(nota).detectado) { setAvisoContacto(true); return }
    setEnviando(true); setError('')
    try {
      const r = await fetch('/api/solicitudes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compita_id: compitaId, tipo: modo, que: esMandado ? 'Mandado' : que, nota: nota.trim() || null,
          lugar_privado: privado, personas_en_lugar: privado ? (nadie ? [] : personas) : null, nadie_mas: privado ? nadie : undefined,
          duracion_min: esMandado ? duracion : undefined, con_foto: tieneFoto,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setError(d.error ?? 'No pudimos enviar tu solicitud. Intenta de nuevo.'); setPorQueError(typeof d.porQue === 'string' ? d.porQue : ''); return }
      setEnviada(true)
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setEnviando(false) }
  }

  const envoltura = { minHeight: '100vh', background: colors.fondoCrudo, fontFamily: fonts.body, padding: `${spacing.lg} ${spacing.md}` } as const
  const tarjeta = { maxWidth: '560px', margin: '0 auto' } as const

  if (enviada) {
    return (
      <main style={envoltura}>
        <div style={{ ...tarjeta, background: colors.blanco, border: `2px solid ${colors.naranja}`, borderRadius: radius.lg, padding: spacing.lg, textAlign: 'center' }}>
          <div style={{ fontSize: '32px' }}>✓</div>
          <h1 style={{ fontFamily: fonts.display, fontSize: '24px', color: colors.textoOscuro, margin: '4px 0 8px' }}>Solicitud enviada</h1>
          <p style={{ color: colors.textoMedio, fontSize: '17px', lineHeight: 1.6, margin: 0 }}>
            {esMandado
              ? `${compitaNombre} recibe tu mandado por Telegram. Te avisamos apenas lo acepte.`
              : modo === 'entrevista'
                ? `${compitaNombre} recibe tu solicitud por Telegram. Cuando acepte, te escribimos por correo para que elijas una de sus horas libres para la videollamada.`
                : `${compitaNombre} recibe tu solicitud por Telegram y acepta primero. Si acepta, te avisamos y pasas al pago. Si no puede, eliges a otro compita sin haber pagado nada.`}
          </p>
          <p style={{ color: colors.textoSutil, fontSize: '15px', lineHeight: 1.5, margin: `${spacing.sm} 0 ${spacing.md}` }}>No necesitas hacer nada más. Si tarda, te avisamos y el equipo de Compaz insiste por ti.</p>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', borderRadius: radius.md, background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '17px', textDecoration: 'none' }}>Ir a mi portal</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={envoltura}>
      <div style={tarjeta}>
        <Link href={`/compitas?compita=${compitaId}`} style={{ color: colors.textoMedio, fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>‹ Volver a los compitas</Link>
        <h1 style={{ fontFamily: fonts.display, fontSize: '26px', color: colors.textoOscuro, margin: `${spacing.sm} 0` }}>
          {esMandado ? `Pídele un mandado a ${compitaNombre}` : `Pídele a ${compitaNombre}`}
        </h1>

        <div role="tablist" aria-label="Qué quieres hacer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.xs }}>
          {MODOS.map((x) => (
            <button key={x.id} role="tab" aria-selected={modo === x.id} onClick={() => cambiarModo(x.id)} style={{ ...chip(modo === x.id), borderRadius: radius.md, fontSize: '14px', lineHeight: 1.2 }}>{x.titulo}</button>
          ))}
        </div>
        <p style={{ color: colors.textoMedio, fontSize: '16px', margin: `${spacing.sm} 0` }}>{m.detalle(compitaNombre, precioMandado)}</p>

        <div style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.lg, padding: spacing.lg, display: 'grid', gap: spacing.lg }}>
          {esMandado ? (
            <>
              <label style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>¿Qué quieres que haga el compita?
                <textarea value={nota} maxLength={MAX_NOTA} onChange={(e) => { setNota(e.target.value); setAvisoContacto(false) }} placeholder="Por ejemplo: llevar unos papeles a una oficina en Chacao" style={{ ...campo, minHeight: '96px', marginTop: spacing.xs, fontWeight: 400, resize: 'vertical' }} />
                <span style={{ fontSize: '13px', fontWeight: 400, color: colors.textoSutil }}>{nota.length} de {MAX_NOTA}</span>
              </label>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>¿Cuánto crees que tomaría?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {DURACIONES_MANDADO_MIN.map((d) => <button key={d} type="button" aria-pressed={duracion === d} onClick={() => setDuracion(d)} style={chip(duracion === d)}>{etiquetaDuracion(d)}</button>)}
                </div>
                <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5, margin: `${spacing.xs} 0 0` }}>Tarifa plana de <b>${precioMandado}</b> por mandado, hasta 1 hora. Las compras no pasan por Compaz: si hay que comprar algo, lo coordinas con el compita por el chat. ¿Va a tomar más de una hora? Escríbenos y lo organizamos aparte.</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>¿Qué necesita tu familiar?</div>
                <p style={{ color: colors.textoMedio, fontSize: '14px', margin: `${spacing.xs} 0 ${spacing.xs}` }}>Elige lo principal. Lo demás lo cuentas abajo.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                  {QUE_OPCIONES.map((q) => <button key={q} type="button" aria-pressed={que === q} onClick={() => setQue(q)} style={chip(que === q)}>{q}</button>)}
                </div>
              </div>
              <label style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>Algo más que el compita deba saber <span style={{ fontWeight: 400, color: colors.textoSutil }}>(opcional)</span>
                <textarea value={nota} maxLength={MAX_NOTA} onChange={(e) => { setNota(e.target.value); setAvisoContacto(false) }} style={{ ...campo, minHeight: '96px', marginTop: spacing.xs, fontWeight: 400, resize: 'vertical' }} />
                <span style={{ fontSize: '13px', fontWeight: 400, color: colors.textoSutil }}>{nota.length} de {MAX_NOTA}</span>
              </label>
            </>
          )}

          {avisoContacto && (
            <div role="alert" style={{ background: colors.amarilloClaro, color: colors.moradoProfundo, borderRadius: radius.md, padding: spacing.md, fontSize: '15px', fontWeight: 700, lineHeight: 1.5 }}>
              Por seguridad, Compaz conecta todo dentro de la plataforma: no hace falta compartir teléfonos ni correos. Este es el primer aviso. Si vuelve a pasar, avisaremos al equipo de Compaz.
              <div style={{ fontWeight: 400, fontSize: '14px', marginTop: '4px' }}>Quita el contacto de tu mensaje y vuelve a enviar. Si lo envías igual, se borra solo.</div>
            </div>
          )}

          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>¿Tu familiar estará en una casa u otro lugar privado?</div>
            <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs }}>
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={privado === v} onClick={() => { setPrivado(v); if (!v) { setPersonas([]); setNadie(false) } }} style={{ ...chip(privado === v), flex: 1 }}>{v ? 'Sí' : 'No'}</button>
              ))}
            </div>
            {privado === true && (
              <div style={{ marginTop: spacing.md }}>
                <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>Además de tu familiar, ¿quién más estará en el lugar? <span style={{ background: colors.amarilloClaro, color: colors.moradoProfundo, borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Obligatorio</span></div>
                <p style={{ color: colors.moradoProfundo, fontSize: '14px', fontWeight: 700, margin: `${spacing.xs} 0` }}>Lo pedimos por la seguridad del compita: tiene que saber con quién se va a encontrar. No se puede enviar la solicitud sin contestar.</p>
                <p style={{ color: colors.textoMedio, fontSize: '14px', margin: `0 0 ${spacing.xs}` }}>Toca una vez por cada persona, o elige «Nadie más».</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                  {TIPOS_PERSONA.map((q) => <button key={q} type="button" onClick={() => { setNadie(false); setPersonas((l) => (l.length < 10 ? [...l, q] : l)) }} style={chip(false)}>+ {q}</button>)}
                </div>
                {personas.length > 0 && (
                  <ul aria-label="Personas que estarán" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, listStyle: 'none', padding: 0, margin: `${spacing.sm} 0 0` }}>
                    {personas.map((q, i) => <li key={i}><button type="button" aria-label={`Quitar: ${q}`} onClick={() => setPersonas((l) => l.filter((_, k) => k !== i))} style={{ ...chip(true), minHeight: '40px', fontSize: '14px' }}>{q} ✕</button></li>)}
                  </ul>
                )}
                <button type="button" aria-pressed={nadie} onClick={() => { setNadie((n) => !n); setPersonas([]) }} style={{ ...chip(nadie), marginTop: spacing.sm }}>Nadie más, solo mi familiar</button>
                <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5, margin: `${spacing.xs} 0 0` }}>El compita ve el tipo de cada persona antes de aceptar. Sus nombres los cuentas después, en la ficha.</p>
              </div>
            )}
            <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5, margin: `${spacing.xs} 0 0` }}>
              {privado === true ? 'Te pediremos la dirección y cómo entrar cuando agendes la cita. El compita la recibe solo unas horas antes.' : 'Si el servicio es en la calle, en una iglesia o en un local, no te pedimos más.'}
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textoOscuro }}>Tu foto <span style={{ fontWeight: 400, color: colors.textoSutil }}>(opcional)</span></div>
            <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5, margin: `${spacing.xs} 0` }}>Ayuda mucho: los compitas aceptan con más confianza a quien pueden ver. Solo la ve el compita mientras decide, desde una página de Compaz (no por Telegram), y se borra a los 90 días.</p>
            {tieneFoto ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
                <span style={{ color: colors.verde, fontWeight: 700, fontSize: '15px' }}>✓ Foto guardada</span>
                <label style={{ ...chip(false), display: 'inline-flex', alignItems: 'center', cursor: subiendoFoto ? 'not-allowed' : 'pointer' }}>Cambiarla
                  <input type="file" accept="image/*" disabled={subiendoFoto} onChange={(e) => { void elegirFoto(e.target.files?.[0]); e.target.value = '' }} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={quitarFoto} disabled={subiendoFoto} style={chip(false)}>Quitarla</button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '48px', borderRadius: radius.md, border: `2px dashed ${colors.gris200}`, color: colors.textoMedio, fontWeight: 700, fontSize: '16px', cursor: subiendoFoto ? 'not-allowed' : 'pointer' }}>
                {subiendoFoto ? 'Subiendo…' : '📷 Agregar mi foto'}
                <input type="file" accept="image/*" disabled={subiendoFoto} onChange={(e) => { void elegirFoto(e.target.files?.[0]); e.target.value = '' }} style={{ display: 'none' }} />
              </label>
            )}
            {errorFoto && <p role="alert" style={{ color: colors.rojo, fontSize: '14px', fontWeight: 700, margin: `${spacing.xs} 0 0` }}>{errorFoto}</p>}
          </div>

          <div style={{ background: colors.fondoCrudo, borderRadius: radius.md, padding: spacing.md, fontSize: '15px' }}>
            <div style={{ fontWeight: 700, color: colors.textoOscuro }}>Sobre tu familiar</div>
            <p style={{ color: colors.textoMedio, margin: `${spacing.xs} 0 0` }}>{familiar ? `${familiar}. Ya lo tenemos guardado; no lo escribes otra vez.` : 'Todavía no completaste su ficha. La completas en tu portal antes de agendar.'}</p>
          </div>

          {error && <p role="alert" style={{ color: colors.rojo, fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}><span>{error}</span>{porQueError && <InfoBoton que="Por qué" texto={porQueError} />}</p>}

          <button type="button" disabled={!listo || enviando} onClick={enviar} style={{ minHeight: '56px', borderRadius: radius.md, border: 'none', background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '18px', cursor: !listo || enviando ? 'not-allowed' : 'pointer', opacity: !listo || enviando ? 0.4 : 1 }}>
            {enviando ? 'Enviando…' : esMandado ? 'Pedir el mandado' : 'Enviar mi solicitud'}
          </button>
          <p style={{ background: colors.amarilloClaro, color: colors.moradoProfundo, borderRadius: radius.md, padding: spacing.sm, fontSize: '13px', lineHeight: 1.5, margin: 0 }}><b>Cuidado con los fraudes.</b> {antifraude}</p>
          {!listo && (
            <p style={{ textAlign: 'center', fontSize: '14px', margin: '-8px 0 0', color: faltaPersonas ? colors.moradoProfundo : colors.textoSutil, fontWeight: faltaPersonas ? 700 : 400 }}>
              {faltaPersonas ? 'Falta indicar quién más estará en el lugar, o elegir «Nadie más». Es obligatorio por seguridad.' : esMandado ? 'Cuéntanos qué necesitas, cuánto tomaría y si es un lugar privado (y quién más estará).' : 'Elige qué necesita tu familiar, si es un lugar privado y, si lo es, quién más estará.'}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
