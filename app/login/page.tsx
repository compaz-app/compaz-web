'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState<'magiclink' | 'password'>('magiclink')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createBrowserSupabase()

    if (modo === 'password') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Credenciales incorrectas.')
      } else if (data.session) {
        await supabase.auth.setSession(data.session)
        const destino = ADMIN_EMAILS.includes(data.session.user.email ?? '') ? '/admin' : '/dashboard'
        window.location.href = destino
      }
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError('Error enviando el correo. Intenta de nuevo.')
    } else {
      setEnviado(true)
    }
    setLoading(false)
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
              <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: '1.6' }}>
                Te enviamos un link a <strong>{email}</strong>. Haz clic en él para entrar.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>
                Entrar
              </h2>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button onClick={() => setModo('magiclink')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', borderColor: modo === 'magiclink' ? '#FF6B2B' : '#E8E0D4', background: modo === 'magiclink' ? '#FFF5F0' : 'white', color: '#2D1464', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}>Link mágico</button>
                <button onClick={() => setModo('password')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', borderColor: modo === 'password' ? '#FF6B2B' : '#E8E0D4', background: modo === 'password' ? '#FFF5F0' : 'white', color: '#2D1464', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}>Contraseña</button>
              </div>

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
                    fontSize: '15px',
                    fontFamily: 'Inter, sans-serif',
                    color: '#1A0A3C',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '16px',
                  }}
                />

                {modo === 'password' && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Contraseña"
                    style={{
                      width: '100%',
                      background: 'white',
                      border: '2px solid rgba(45,20,100,0.2)',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      fontSize: '15px',
                      fontFamily: 'Inter, sans-serif',
                      color: '#1A0A3C',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: '16px',
                    }}
                  />
                )}

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
                  {loading ? 'Entrando...' : modo === 'password' ? 'Entrar' : 'Enviar link de acceso'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
