'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const modo = 'magiclink'
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const router = useRouter()

  // Mensaje cuando el callback de autenticación devolvió al usuario aquí con un error
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const e = p.get('error')
    if (!e) return
    const motivo = p.get('motivo')
    setError(
      e === 'bloqueado'
        ? 'Tu cuenta está suspendida. Si crees que es un error, escríbenos a hola@micompaz.com.'
        : e === 'no-invitado'
        ? 'Esta cuenta aún no tiene acceso. Escribe tu correo aquí abajo para recibir un enlace nuevo, o escríbenos a hola@micompaz.com.'
        : `Ese enlace ya se usó o venció. Escribe tu correo aquí abajo y te enviamos uno nuevo al instante.${motivo ? ` (motivo: ${motivo})` : ''}`,
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // El acceso se pide al servidor: funciona también para invitaciones vencidas o sin activar,
    // y el enlace se abre desde cualquier navegador o dispositivo.
    try {
      const res = await fetch('/api/auth/solicitar-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? 'No pudimos enviar el enlace. Intenta de nuevo en unos minutos o escríbenos a hola@micompaz.com.')
      } else {
        setEnviado(true)
        setCooldown(60)
        const interval = setInterval(() => {
          setCooldown((s) => { if (s <= 1) { clearInterval(interval); return 0 } return s - 1 })
        }, 1000)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  async function reenviar() {
    if (cooldown > 0) return
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

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
              <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', marginBottom: '20px' }}>
                Te enviamos un link a <strong>{email}</strong>. Haz clic en él para entrar.
              </p>
              <button
                onClick={reenviar}
                disabled={cooldown > 0}
                style={{ background: 'none', border: '2px solid #D4C9E8', color: cooldown > 0 ? '#9B8AB8' : '#4A3B6B', borderRadius: '9999px', padding: '8px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
              >
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar correo'}
              </button>
              <p style={{ color: '#9B8AB8', fontSize: '13px', lineHeight: '1.6' }}>
                Si el correo no llega, revisa tu carpeta de spam. Si sigue sin aparecer, puedes{' '}
                <button onClick={() => setEnviado(false)} style={{ background: 'none', border: 'none', color: '#FF6B2B', fontWeight: 700, cursor: 'pointer', fontSize: '13px', padding: 0, fontFamily: 'Inter, sans-serif' }}>
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
                <label style={{ display: 'block', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  style={{
                    width: '100%',
                    background: 'white',
                    border: '2px solid rgba(45,20,100,0.2)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    fontSize: '16px',
                    fontFamily: 'Inter, sans-serif',
                    color: '#1A0A3C',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '16px',
                  }}
                />


                {error && (
                  <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? '#E8E0D4' : '#FF6B2B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '16px',
                    fontSize: '16px',
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {loading ? 'Entrando...' : 'Enviar link de acceso'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
