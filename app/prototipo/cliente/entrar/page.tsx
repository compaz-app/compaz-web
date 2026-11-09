'use client'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useParam } from '../../useUrlState'
import AvisoSeguridad from '../../AvisoSeguridad'

type Paso = 'correo' | 'enviado' | 'codigo' | 'dentro' | 'ayuda' | 'ayuda_ok'

function EntrarInner() {
  // Adónde lo lleva el acceso: ?para=pago cuando entra desde el correo de pago confirmado; por defecto es su primer acceso.
  const desdePago = useParam('para') === 'pago'
  const [paso, setPaso] = useState<Paso>('correo')
  const [correo, setCorreo] = useState('')
  const [espera, setEspera] = useState(0)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const enviar = () => { setPaso('enviado'); setEspera(60) }

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <div className="text-2xl font-extrabold text-[var(--purple)]">Compaz</div>

      {paso === 'correo' && (
        <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-6">
          <h1 className="text-2xl font-extrabold">Entra a tu portal</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">Escribe tu correo y te mandamos un enlace para entrar. No necesitas contraseña.</p>
          <label className="mt-4 block text-base font-bold" htmlFor="correo">Tu correo</label>
          <input id="correo" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@correo.com" className="mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg" />
          <button disabled={!correo.includes('@')} onClick={enviar} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">Enviarme el enlace</button>
        </section>
      )}

      {paso === 'enviado' && (
        <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-6">
          <div className="text-4xl">📬</div>
          <h1 className="mt-2 text-2xl font-extrabold">Revisa tu correo</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">Te enviamos un enlace a <b>{correo}</b>. Tócalo y entras.</p>
          <div className="mt-4 rounded-2xl bg-[var(--warm-gray)] p-4 text-base">
            <b>Usa siempre el correo más reciente.</b> Si pides otro, el anterior deja de servir.
          </div>
          <button onClick={() => setPaso('codigo')} className="mt-4 min-h-14 w-full rounded-2xl border-2 border-[var(--purple)] bg-white text-lg font-extrabold text-[var(--purple)]">¿Abriste el correo en otra app? Usa un código</button>
          <button onClick={() => setPaso('correo')} className="mt-3 min-h-12 w-full text-base font-bold text-[var(--text-mid)]">Me equivoqué de correo</button>
          <button onClick={() => setPaso('ayuda')} className="mt-1 min-h-12 w-full text-base font-bold text-[var(--orange-dark)] underline">¿No te llega el correo? Escríbenos</button>
          <button disabled={espera > 0} onClick={() => setEspera(60)} className="mt-3 min-h-12 w-full rounded-2xl border border-[var(--border-muted)] bg-white text-base font-bold text-[var(--text-mid)] disabled:opacity-60">
            {espera > 0 ? `Puedes pedir otro en ${espera} segundos` : 'Enviarme otro enlace'}
          </button>
        </section>
      )}

      {paso === 'codigo' && (
        <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-6">
          <h1 className="text-2xl font-extrabold">Escribe tu código</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">En el mismo correo hay un código de 8 números. Escríbelo aquí y entras. Nadie de Compaz te lo va a pedir: es solo para escribirlo aquí.</p>
          <input inputMode="numeric" maxLength={8} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="00000000" aria-label="Código de 8 números" className="mt-4 min-h-16 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-center text-3xl font-extrabold tracking-[0.4em]" />
          <button disabled={codigo.length < 8} onClick={() => setPaso('dentro')} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">Entrar</button>
          <button onClick={() => setPaso('enviado')} className="mt-3 min-h-12 w-full text-base font-bold text-[var(--text-mid)]">‹ Volver</button>
        </section>
      )}

      {paso === 'ayuda' && (
        <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-6">
          <h1 className="text-2xl font-extrabold">Cuéntanos qué pasa</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">Si no te llega el correo, el equipo de Compaz te ayuda. Responderemos con los datos que dejaste al registrarte.</p>
          <label className="mt-4 block text-base font-bold">Tu nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg font-normal" /></label>
          <label className="mt-3 block text-base font-bold">Tu correo<input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" inputMode="email" className="mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg font-normal" /></label>
          <label className="mt-3 block text-base font-bold">¿Qué pasa? <span className="font-normal text-[var(--text-light)]">(opcional)</span><textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} className="mt-1 min-h-20 w-full rounded-2xl border border-[var(--border-muted)] p-3 text-lg font-normal" /></label>
          <button disabled={!nombre.trim() || !correo.includes('@')} onClick={() => setPaso('ayuda_ok')} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">Pedir ayuda</button>
          <button onClick={() => setPaso('enviado')} className="mt-3 min-h-12 w-full text-base font-bold text-[var(--text-mid)]">‹ Volver</button>
        </section>
      )}

      {paso === 'ayuda_ok' && (
        <section className="mt-6 rounded-3xl border-2 border-[var(--orange)] bg-white p-6 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="mt-2 text-2xl font-extrabold">Recibimos tu mensaje</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">El equipo de Compaz te ayudará lo antes posible. Mientras tanto, revisa también la carpeta de correo no deseado.</p>
          <button onClick={() => setPaso('correo')} className="mt-4 min-h-14 w-full rounded-2xl border-2 border-[var(--purple)] bg-white text-lg font-extrabold text-[var(--purple)]">Intentar con otro correo</button>
        </section>
      )}

      {paso === 'dentro' && (
        <section className="mt-6 rounded-3xl border-2 border-[var(--orange)] bg-white p-6 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="mt-2 text-2xl font-extrabold">Listo, Carolina</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">{desdePago ? 'Te llevamos justo a lo que estabas haciendo: tu pago ya está confirmado y falta completar la ficha de tu familiar.' : 'Bienvenida a Compaz. Lo primero es contarnos de tu familiar, para que tu compita lo conozca.'}</p>
          <Link href={desdePago ? '/prototipo/cliente?estado=ficha' : '/prototipo/cliente?sec=familiar'} className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Ir a mi portal</Link>
        </section>
      )}

      <AvisoSeguridad />

    </main>
  )
}

// useParam lee la URL: Next exige una frontera Suspense para construir la página estática.
export default function Entrar() {
  return <Suspense><EntrarInner /></Suspense>
}
