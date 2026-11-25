'use client'

import { useEffect, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import { createBrowserSupabase } from '@/lib/supabase'

// Segundo factor del panel. Dos casos: (1) todavía no tienes autenticador: se registra (QR o clave y un código de prueba); (2) ya lo tienes: se pide el código de 6 dígitos.
// Todo lo hace Supabase; aquí solo se guía a la persona. Al terminar se recarga la página completa para que el servidor vea la sesión nueva.
type Fase = { tipo: 'cargando' } | { tipo: 'registrar'; factorId: string; qr: string; clave: string } | { tipo: 'confirmar'; factorId: string } | { tipo: 'error'; texto: string }

export default function SegundoFactor({ volverA, reconfirmar, obligatorio, correo }: { volverA: string; reconfirmar: boolean; obligatorio: boolean; correo: string }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'cargando' })
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const mfa = createBrowserSupabase().auth.mfa
      const { data, error } = await mfa.listFactors()
      if (!vivo) return
      if (error) { setFase({ tipo: 'error', texto: 'No pudimos revisar tu autenticador. Recarga la página.' }); return }
      const listo = data?.totp?.find((f) => f.status === 'verified')
      if (listo) { setFase({ tipo: 'confirmar', factorId: listo.id }); return }
      // Registros a medias de otro intento: se quitan para no acumularlos.
      for (const f of data?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await mfa.unenroll({ factorId: f.id })
      const nuevo = await mfa.enroll({ factorType: 'totp', friendlyName: `Compaz ${Date.now()}` })
      if (!vivo) return
      if (nuevo.error || !nuevo.data) { setFase({ tipo: 'error', texto: 'No pudimos preparar el autenticador. Puede que el segundo factor no esté activado en Supabase.' }); return }
      setFase({ tipo: 'registrar', factorId: nuevo.data.id, qr: nuevo.data.totp.qr_code, clave: nuevo.data.totp.secret })
    })().catch(() => vivo && setFase({ tipo: 'error', texto: 'No pudimos preparar el autenticador. Intenta de nuevo.' }))
    return () => { vivo = false }
  }, [])

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (fase.tipo !== 'registrar' && fase.tipo !== 'confirmar') return
    if (!/^\d{6}$/.test(codigo.trim())) { setFallo('Escribe los 6 números que muestra tu aplicación.'); return }
    setEnviando(true); setFallo(null)
    try {
      const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: fase.factorId, code: codigo.trim() })
      if (error) { setFallo('Ese código no es válido o ya venció. Escribe el que muestra ahora tu aplicación.'); return }
      window.location.href = volverA
    } catch { setFallo('Sin conexión. Intenta de nuevo.') } finally { setEnviando(false) }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="m-0 flex items-center gap-1 text-2xl font-extrabold text-morado-profundo">
        {reconfirmar ? 'Confirma tu autenticador' : 'Segundo factor'}
        <InfoBoton que="Qué es el segundo factor" texto="Además del código del correo, pides un código de 6 números que cambia cada 30 segundos y solo lo muestra tu teléfono. Así, aunque alguien consiga tu correo, no puede entrar al panel, donde se ven datos de salud, pagos y cuentas." />
      </h1>
      <p className="m-0 text-base text-morado-claro">{correo}</p>
      {obligatorio && <Aviso tono="advertencia">El panel exige el segundo factor. Sin confirmarlo no puedes usarlo.</Aviso>}

      {fase.tipo === 'cargando' && <p role="status" className="m-0 text-base text-morado-sutil">Preparando…</p>}
      {fase.tipo === 'error' && <Aviso tono="peligro">{fase.texto}</Aviso>}

      {fase.tipo === 'registrar' && (
        <div className="space-y-3">
          <ol className="m-0 space-y-1 pl-5 text-base text-morado-profundo">
            <li>Instala una aplicación de autenticación (Google Authenticator, Microsoft Authenticator o similar).</li>
            <li>Escanea este código con la aplicación, o escribe la clave a mano.</li>
            <li>Escribe aquí los 6 números que muestra.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fase.qr} alt="Código QR para registrar el autenticador" width={192} height={192} className="mx-auto block rounded-xl border border-borde bg-blanco p-2" />
          <p className="m-0 break-all rounded-xl bg-fondo-claro px-3 py-2 text-center text-sm font-bold text-morado-profundo">{fase.clave}</p>
        </div>
      )}

      {(fase.tipo === 'registrar' || fase.tipo === 'confirmar') && (
        <form onSubmit={verificar} className="space-y-3">
          <label className="block text-sm font-bold text-morado-profundo">
            Código de 6 números
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              className="mt-1 block w-full rounded-xl border-2 border-borde bg-blanco p-3 text-center text-2xl font-extrabold tracking-[0.4em] text-morado-profundo" />
          </label>
          {fallo && <p role="alert" className="m-0 text-sm font-bold text-rojo-oscuro">{fallo}</p>}
          <Boton type="submit" cargando={enviando} info={fase.tipo === 'registrar' ? 'Comprueba que tu aplicación quedó bien registrada y activa el segundo factor en tu cuenta.' : 'Confirma que eres tú con el código de tu aplicación y te lleva a donde ibas.'}>
            {fase.tipo === 'registrar' ? 'Activar y continuar' : 'Confirmar'}
          </Boton>
        </form>
      )}
    </main>
  )
}
