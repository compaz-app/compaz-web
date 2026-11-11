'use client'

import { explicarEspera } from '@/lib/esperas'
import InfoBoton from '@/components/ui/InfoBoton'
import { useState, useEffect } from 'react'

// Formulario de acceso. Tres cosas nuevas frente a la versión anterior (ver docs/ciclo-comunicaciones.md, regla 5):
// 1. el tiempo de espera para pedir otro correo lo da el servidor y se ve en pantalla (antes el límite era silencioso),
// 2. se puede entrar con el código numérico del correo (sirve si el enlace se abrió en otra app o teléfono),
// 3. el correo avisa que hay que usar siempre el más reciente (un enlace nuevo invalida el anterior).
function mensajeDeError(e: string | undefined, motivo: string | undefined): string {
  if (!e) return ''
  if (e === 'bloqueado') return 'Tu cuenta está suspendida. Si crees que es un error, escríbenos a hola@micompaz.com.'
  if (e === 'no-invitado') return 'Esta cuenta aún no tiene acceso. Escribe tu correo aquí abajo para recibir un enlace nuevo, o escríbenos a hola@micompaz.com.'
  return `Ese enlace ya se usó o venció. Escribe tu correo aquí abajo y te enviamos uno nuevo al instante.${motivo ? ` (motivo: ${motivo})` : ''}`
}

// returnTo, error y motivo llegan de la dirección a través de la página (servidor).
export default function LoginForm({ returnTo = '', error: errorInicial, motivo }: { returnTo?: string; error?: string; motivo?: string }) {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => mensajeDeError(errorInicial, motivo))
  const [aviso, setAviso] = useState('')
  // La razón de un límite (si el servidor la manda) va detrás de un ⓘ, no a la vista.
  const [porQue, setPorQue] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [codigo, setCodigo] = useState('')
  const [verificando, setVerificando] = useState(false)

  // Cuenta atrás visible: un segundo menos cada segundo mientras queden
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function pedirAcceso() {
    setLoading(true)
    setError('')
    setAviso(''); setPorQue('')
    try {
      const res = await fetch('/api/auth/solicitar-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(returnTo ? { returnTo } : {}) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? 'No pudimos enviar el enlace. Intenta de nuevo en unos minutos o escríbenos a hola@micompaz.com.'); setPorQue(typeof d.porQue === 'string' ? d.porQue : '')
      } else {
        const espera = Number(d.data?.espera ?? 60)
        setEnviado(true)
        setCooldown(espera)
        // Menos de 60 s significa que ya se había enviado uno hace un momento: se dice, en vez de callar
        if (espera < 60) { const e = explicarEspera('acceso_correo', { desde: new Date(Date.now() - (60 - espera) * 1000), duracionMs: 60_000 }); setAviso(e.resumen); setPorQue(e.porQue) }
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await pedirAcceso()
  }

  async function entrarConCodigo(e: React.FormEvent) {
    e.preventDefault()
    setVerificando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, ...(returnTo ? { returnTo } : {}) }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.data?.destino) {
        window.location.href = d.data.destino
        return
      }
      setError(d.error ?? 'Ese código no es válido o ya venció.'); setPorQue(typeof d.porQue === 'string' ? d.porQue : '')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setVerificando(false)
  }

  const estiloBoton = (activo: boolean) => ({
    width: '100%',
    background: activo ? '#FF6B2B' : '#E8E0D4',
    color: 'white',
    border: 'none',
    borderRadius: '9999px',
    padding: '16px',
    fontSize: '16px',
    fontFamily: 'Bricolage Grotesque, sans-serif',
    fontWeight: 800,
    cursor: activo ? 'pointer' : 'not-allowed',
    transition: 'background 0.2s',
  } as const)

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Compaz
          </div>
          <p style={{ color: '#6B5C90', marginTop: '8px', fontFamily: 'Inter, sans-serif' }}>
            Portal de clientes
          </p>
        </div>

        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '32px' }}>
          {enviado ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉️</div>
              <h2 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, marginBottom: '12px' }}>
                Revisa tu correo
              </h2>
              <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', marginBottom: '12px' }}>
                Te enviamos un correo a <strong>{email}</strong>. Pulsa el botón que trae para entrar.
              </p>
              {aviso && (
                <p style={{ background: '#FFF7E6', border: '2px solid #F5B800', borderRadius: '12px', padding: '10px 14px', color: '#7a5b00', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' }}>
                  {aviso}{porQue && <InfoBoton que="Por qué" texto={porQue} />}
                </p>
              )}
              <p style={{ background: '#F5F0FF', borderRadius: '12px', padding: '10px 14px', color: '#4A3B6B', fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
                Usa siempre el correo <strong>más reciente</strong>. Si pides otro, el anterior deja de servir.
              </p>

              <form onSubmit={entrarConCodigo} style={{ textAlign: 'left', marginBottom: '20px' }}>
                <label htmlFor="codigo" style={{ display: 'block', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  ¿El enlace no funciona? Escribe el código del correo
                </label>
                <input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código"
                  style={{ width: '100%', background: 'white', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '14px 18px', fontSize: '20px', letterSpacing: '4px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#1A0A3C', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                />
                {error && (
                  <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>{error}{porQue && <InfoBoton que="Por qué" texto={porQue} />}</p>
                )}
                <button type="submit" disabled={verificando || codigo.length < 6} style={estiloBoton(!verificando && codigo.length >= 6)}>
                  {verificando ? 'Entrando...' : 'Entrar con el código'}
                </button>
              </form>

              <button
                onClick={pedirAcceso}
                disabled={cooldown > 0 || loading}
                style={{ background: 'none', border: '2px solid #D4C9E8', color: cooldown > 0 ? '#9B8AB8' : '#4A3B6B', borderRadius: '9999px', padding: '8px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
              >
                {cooldown > 0 ? `Puedes pedir otro en ${cooldown} s` : 'Enviarme otro correo'}
              </button>
              <p style={{ color: '#9B8AB8', fontSize: '13px', lineHeight: '1.6' }}>
                Si el correo no llega, revisa tu carpeta de spam. Si sigue sin aparecer, puedes{' '}
                <button onClick={() => { setEnviado(false); setCodigo(''); setError(''); setAviso('') }} style={{ background: 'none', border: 'none', color: '#FF6B2B', fontWeight: 700, cursor: 'pointer', fontSize: '13px', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                  intentarlo con otro correo
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>
                Entrar
              </h2>
              <p style={{ background: '#F5F0FF', border: '2px solid rgba(45,20,100,0.12)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#4A3B6B', lineHeight: '1.6', marginBottom: '20px' }}>
                Escribe tu correo y te enviaremos un enlace. Solo haz clic en él para entrar directamente, sin necesidad de recordar ninguna contraseña.
              </p>

              <form onSubmit={handleSubmit}>
                <label htmlFor="correo" style={{ display: 'block', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Correo electrónico
                </label>
                <input
                  id="correo"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  style={{ width: '100%', background: 'white', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '14px 18px', fontSize: '16px', fontFamily: 'Inter, sans-serif', color: '#1A0A3C', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />

                {error && (
                  <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} style={estiloBoton(!loading)}>
                  {loading ? 'Enviando...' : 'Enviar link de acceso'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
