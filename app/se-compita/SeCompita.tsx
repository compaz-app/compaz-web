'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Banknote, Clock, MapPin, HeartHandshake, Check } from 'lucide-react'
import SelectorEstadoCiudad from '@/components/ui/SelectorEstadoCiudad'
import WaveDivider from '@/components/ui/WaveDivider'
import { colors, fonts, radius, zIndex } from '@/lib/design'
import { VE_PREFIJOS } from '@/lib/venezuela'
import { enviarPostulacionCompita } from '@/lib/postulaciones'

// Ancla del formulario. El QR impreso trae #formulario: al no existir aquí, la página abre en el hero.
const ANCLA_FORMULARIO = 'postulacion'

const BLANCO_SUAVE = 'rgba(255,255,255,0.80)'
const SOMBRA_CTA_HERO = '0 8px 24px rgba(224, 85, 32, 0.30)'

const estiloCampo = {
  backgroundColor: colors.blanco,
  color: colors.textoOscuro,
  fontFamily: fonts.body,
  '--tw-ring-color': colors.moradoMedio,
} as CSSProperties

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0"
      style={{ backgroundColor: colors.moradoMedio, zIndex: zIndex.sticky }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" aria-label="Compaz, ir al inicio">
          <Image src="/logo-nav.webp" alt="Compaz" width={200} height={63} className="h-9 w-auto object-contain" priority />
        </Link>
        <a
          href={`#${ANCLA_FORMULARIO}`}
          className="inline-flex items-center font-semibold text-sm px-5 min-h-[44px] hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: colors.naranja, color: colors.blanco, borderRadius: radius.pill }}
        >
          Postúlate
        </a>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ backgroundColor: colors.moradoMedio }} className="pt-28 pb-12 lg:pt-36 lg:pb-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h1
            className="font-extrabold mb-5"
            style={{
              color: colors.blanco,
              fontFamily: fonts.display,
              fontSize: 'clamp(2.25rem, 7vw, 4rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              textWrap: 'balance',
            }}
          >
            Una hora tuya puede ser lo mejor de su semana.
          </h1>
          <p
            className="text-lg leading-relaxed mb-8 max-w-xl"
            style={{ color: BLANCO_SUAVE, fontFamily: fonts.body, textWrap: 'pretty' }}
          >
            Hay adultos mayores en Caracas cuyos hijos viven lejos. Como Compita, los visitas, conversas con ellos y los acompañas, y te pagamos por cada hora.
          </p>
          <a
            href={`#${ANCLA_FORMULARIO}`}
            className="inline-flex items-center justify-center font-bold text-base px-8 py-4 min-h-[44px] w-full sm:w-auto hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: colors.naranja,
              color: colors.blanco,
              borderRadius: radius.pill,
              fontFamily: fonts.display,
              boxShadow: SOMBRA_CTA_HERO,
            }}
          >
            Quiero ser Compita
          </a>
        </div>
        <div className="relative w-full overflow-hidden" style={{ borderRadius: radius.lg, aspectRatio: '4 / 3' }}>
          <Image
            src="/images/plaza-v2.webp"
            alt="Un joven juega ajedrez con una señora mayor en una plaza"
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </div>
    </section>
  )
}

// ─── Qué hace un Compita ──────────────────────────────────────────────────────

const actividades = [
  'Conversar y escuchar',
  'Salir a pasear o a comer',
  'Hacer diligencias juntos',
  'Jugar cartas o dominó',
  'Acompañar a una cita',
  'Contarle a la familia cómo estuvo',
]

function QueHace() {
  return (
    <section style={{ backgroundColor: colors.fondoCrudo }} className="py-16 lg:py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-extrabold mb-5"
          style={{ color: colors.moradoMedio, fontFamily: fonts.display, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: 1.15, textWrap: 'balance' }}
        >
          ¿Qué hace un Compita?
        </h2>
        <p
          className="text-base leading-relaxed mb-10 max-w-2xl mx-auto"
          style={{ color: colors.textoMedio, fontFamily: fonts.body, textWrap: 'pretty' }}
        >
          Pasa tiempo de calidad con una persona mayor, como lo haría un nieto o un buen vecino. No hace falta experiencia: hace falta paciencia, puntualidad y ganas de acompañar.
        </p>
        <ul className="flex flex-wrap justify-center gap-3">
          {actividades.map((a) => (
            <li
              key={a}
              className="px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.fondoClaro, color: colors.moradoMedio, borderRadius: radius.md, fontFamily: fonts.body }}
            >
              {a}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Beneficios ───────────────────────────────────────────────────────────────

const beneficios = [
  { Icon: Banknote, titulo: 'Pago por hora', desc: 'En dólares o bolívares.' },
  { Icon: Clock, titulo: 'Horario flexible', desc: 'Sin mínimo de horas. Aceptas solo las visitas que te funcionan.' },
  { Icon: MapPin, titulo: 'Cerca de ti', desc: 'Eliges las zonas donde quieres acompañar.' },
  { Icon: HeartHandshake, titulo: 'Con respaldo', desc: 'El equipo de Compaz te apoya antes, durante y después de cada visita.' },
]

function Beneficios() {
  return (
    <section style={{ backgroundColor: colors.moradoMedio }} className="py-16 lg:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="font-extrabold text-center mb-10 lg:mb-14"
          style={{ color: colors.blanco, fontFamily: fonts.display, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: 1.15, textWrap: 'balance' }}
        >
          Lo que te llevas
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-10">
          {beneficios.map(({ Icon, titulo, desc }) => (
            <li key={titulo} className="flex gap-4">
              <Icon size={32} strokeWidth={1.6} className="flex-shrink-0" style={{ color: colors.naranja }} aria-hidden="true" />
              <div>
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.blanco, fontFamily: fonts.display }}>
                  {titulo}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: BLANCO_SUAVE, fontFamily: fonts.body }}>
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Formulario ───────────────────────────────────────────────────────────────

const requisitos = ['Tienes 18 años o más', 'Tienes WhatsApp y Telegram']

const FORM_VACIO = {
  nombre: '',
  prefijo: '0412',
  numero: '',
  email: '',
  estado: '',
  ciudad: '',
  confirmaRequisitos: false,
  website: '',
}

type Analitica = {
  gtag?: (...args: unknown[]) => void
  fbq?: (...args: unknown[]) => void
  turnstile?: { reset: () => void }
}

function Formulario() {
  const [form, setForm] = useState(FORM_VACIO)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.numero.length !== 7) {
      setStatus('error')
      setError('El número debe tener 7 dígitos después del prefijo.')
      return
    }
    setStatus('loading')
    setError('')
    const turnstileToken =
      (e.currentTarget.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value ?? ''
    const w = window as typeof window & Analitica

    const resultado = await enviarPostulacionCompita({
      nombre: form.nombre,
      prefijo: form.prefijo,
      numero: form.numero,
      email: form.email,
      estado: form.estado,
      ciudad: form.ciudad,
      website: form.website,
      turnstileToken,
    })

    if (!resultado.ok) {
      // Se conserva lo escrito; el token de Turnstile ya se usó, así que se pide uno nuevo.
      setStatus('error')
      setError(resultado.error)
      w.turnstile?.reset()
      return
    }

    setStatus('ok')
    setForm(FORM_VACIO)
    w.gtag?.('event', 'form_submit', { event_category: 'waitlist', compita: true })
    w.fbq?.('track', 'Lead')
    document.getElementById(ANCLA_FORMULARIO)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id={ANCLA_FORMULARIO}
      style={{ backgroundColor: colors.amarilloMarca, scrollMarginTop: '64px' }}
      className="py-16 lg:py-24 px-4 sm:px-6"
    >
      <div className="max-w-xl mx-auto">
        {status === 'ok' ? (
          <div role="status" className="p-8 text-center" style={{ backgroundColor: colors.blanco, borderRadius: radius.lg }}>
            <p className="text-2xl font-extrabold mb-3" style={{ color: colors.moradoMedio, fontFamily: fonts.display }}>
              ¡Listo! Recibimos tu postulación.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textoMedio, fontFamily: fonts.body }}>
              En breve te enviaremos un formulario corto. Cuando lo completes, te llamaremos por WhatsApp para conocerte.
            </p>
          </div>
        ) : (
          <>
            <h2
              className="font-extrabold text-center mb-4"
              style={{ color: colors.textoOscuro, fontFamily: fonts.display, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: 1.15, textWrap: 'balance' }}
            >
              Postúlate como Compita
            </h2>
            <ul className="flex flex-col sm:flex-row sm:justify-center gap-2 sm:gap-6 mb-8">
              {requisitos.map((r) => (
                <li key={r} className="flex items-center justify-center gap-2 text-base font-medium" style={{ color: colors.moradoMedio, fontFamily: fonts.body }}>
                  <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                  {r}
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
              />

              <input
                type="text"
                required
                autoComplete="name"
                aria-label="Tu nombre y apellido"
                placeholder="Tu nombre y apellido"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2"
                style={estiloCampo}
              />

              <div className="flex gap-2">
                <select
                  aria-label="Prefijo de tu WhatsApp"
                  value={form.prefijo}
                  onChange={(e) => setForm({ ...form, prefijo: e.target.value })}
                  className="rounded-xl px-3 py-4 text-base outline-none focus:ring-2 flex-shrink-0"
                  style={estiloCampo}
                >
                  {VE_PREFIJOS.map((p) => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  autoComplete="tel-local"
                  aria-label="Número de WhatsApp (7 dígitos)"
                  placeholder="WhatsApp, 7 dígitos"
                  value={form.numero}
                  maxLength={7}
                  onChange={(e) => setForm({ ...form, numero: e.target.value.replace(/\D/g, '') })}
                  className="min-w-0 flex-1 rounded-xl px-5 py-4 text-base outline-none focus:ring-2"
                  style={estiloCampo}
                />
              </div>

              <input
                type="email"
                required
                autoComplete="email"
                aria-label="Tu email"
                placeholder="Tu email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2"
                style={estiloCampo}
              />

              <p className="text-sm font-semibold px-1 -mb-2" style={{ color: colors.textoOscuro, fontFamily: fonts.body }}>
                ¿Dónde vives?
              </p>
              <SelectorEstadoCiudad
                estado={form.estado}
                ciudad={form.ciudad}
                onChange={({ estado, ciudad }) => setForm({ ...form, estado, ciudad })}
                placeholderEstado="Estado donde vives"
              />

              <label
                className="flex items-start gap-3 px-5 py-4 cursor-pointer text-sm"
                style={{ backgroundColor: colors.blanco, color: colors.textoOscuro, borderRadius: radius.md, fontFamily: fonts.body }}
              >
                <input
                  type="checkbox"
                  required
                  checked={form.confirmaRequisitos}
                  onChange={(e) => setForm({ ...form, confirmaRequisitos: e.target.checked })}
                  className="w-5 h-5 mt-0.5 flex-shrink-0 cursor-pointer"
                  style={{ accentColor: colors.moradoMedio }}
                />
                Tengo 18 años o más, y tengo WhatsApp y Telegram.
              </label>

              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div
                  className="cf-turnstile"
                  data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  data-theme="light"
                  data-language="es"
                />
              )}

              {status === 'error' && error && (
                <p
                  role="alert"
                  className="text-sm font-medium px-4 py-3"
                  style={{ backgroundColor: colors.rojoClaro, color: colors.textoOscuro, borderLeft: `4px solid ${colors.rojo}`, borderRadius: radius.sm, fontFamily: fonts.body }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full font-bold text-base py-4 min-h-[44px] transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: colors.naranja, color: colors.blanco, borderRadius: radius.pill, fontFamily: fonts.display }}
              >
                {status === 'loading' ? 'Enviando…' : 'Quiero ser Compita'}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ backgroundColor: colors.moradoProfundo }} className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Image src="/logo-mono.png" alt="Compaz" width={160} height={50} className="h-10 w-auto object-contain" />
        <Link href="/privacidad" className="text-sm" style={{ color: BLANCO_SUAVE, fontFamily: fonts.body }}>
          Privacidad
        </Link>
        <p className="text-xs" style={{ color: BLANCO_SUAVE, fontFamily: fonts.body }}>
          © 2026 Compaz. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SeCompita() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WaveDivider from={colors.moradoMedio} to={colors.fondoCrudo} shape={3} />
        <QueHace />
        <WaveDivider from={colors.fondoCrudo} to={colors.moradoMedio} shape={1} flip />
        <Beneficios />
        <WaveDivider from={colors.moradoMedio} to={colors.amarilloMarca} shape={2} />
        <Formulario />
      </main>
      <Footer />
    </>
  )
}
