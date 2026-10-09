'use client'

import { useState, useEffect } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
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
      e === 'no-invitado'
        ? 'Este correo no está registrado. Usa el correo con el que fuiste invitado o escríbenos a hola@micompaz.com.'
        : `No pudimos completar tu ingreso con ese enlace. Es posible que ya se haya usado o que se abriera en otro navegador. Pide uno nuevo y ábrelo en el mismo navegador.${motivo ? ` (motivo: ${motivo})` : ''}`,
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createBrowserSupabase()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Acceso solo por invitación: no crear usuarios nuevos desde el formulario de login
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('[login] signInWithOtp falló:', error.status, error.code, error.message)
      const m = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
      if (error.status === 429 || m.includes('rate limit') || m.includes('over_email_send_rate_limit')) {
        setError('Se enviaron demasiados enlaces en poco tiempo. Espera unos minutos y vuelve a intentar.')
      } else if (m.includes('signup') || m.includes('not allowed') || m.includes('otp_disabled') || m.includes('user not found')) {
        setError('Este correo no está registrado. Usa el correo con el que fuiste invitado o escríbenos a hola@micompaz.com.')
      } else {
        setError(`No pudimos enviar el enlace. Intenta de nuevo en unos minutos o escríbenos a hola@micompaz.com. (código: ${error.code ?? error.status ?? 'desconocido'})`)
      }
    } else {
      setEnviado(true)
      setCooldown(30)
      const interval = setInterval(() => {
        setCooldown((s) => { if (s <= 1) { clearInterval(interval); return 0 } return s - 1 })
      }, 1000)
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
