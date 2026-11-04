'use client'
import Link from 'next/link'
import { Suspense } from 'react'
import { useUrlState } from '../useUrlState'
import { CICLO, REGLAS } from '../ciclo-data'

const ACTOR: Record<string, string> = {
  Cliente: 'bg-[var(--purple)]/10 text-[var(--purple)]',
  Compita: 'bg-[var(--orange)]/15 text-[var(--orange-dark)]',
  Admin: 'bg-[var(--yellow)] text-[var(--purple-dark)]',
  Sistema: 'bg-[var(--warm-gray)] text-[var(--text-mid)]',
}

function Campo({ t, v }: { t: string; v: string }) {
  return <div><dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-light)]">{t}</dt><dd className="mt-0.5 text-base text-[var(--text-dark)]">{v}</dd></div>
}

function Inner() {
  const fases = ['Todas', ...Array.from(new Set(CICLO.map((f) => f.fase)))]
  const [fase, setFase] = useUrlState('fase', 'Todas')
  const filas = CICLO.map((f, i) => ({ f, i })).filter(({ f }) => fase === 'Todas' || f.fase === fase)

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <h1 className="text-3xl font-extrabold">El ciclo completo, encadenado</h1>
      <p className="mt-1 text-lg text-[var(--text-mid)]">Cada paso dice quién actúa, qué aviso recibe, con qué botón y a dónde llega. Así nadie se pierde entre correos, Telegram y portal.</p>

      <section className="mt-6">
        <h2 className="text-xl font-extrabold">Las 8 reglas</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-2">
          {REGLAS.map((r, i) => (
            <li key={r.t} className="flex gap-3 rounded-2xl border border-[var(--border-muted)] bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--purple)] font-extrabold text-white">{i + 1}</span>
              <div><div className="font-extrabold">{r.t}</div><div className="text-[var(--text-mid)]">{r.d}</div></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">Paso a paso</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {fases.map((f) => (
            <button key={f} onClick={() => setFase(f)} aria-pressed={fase === f} className={`min-h-10 rounded-full px-3 text-sm font-bold ${fase === f ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>{f}</button>
          ))}
        </div>
        <ul className="mt-4 grid gap-3">
          {filas.map(({ f, i }) => (
            <li key={i} className="rounded-3xl border border-[var(--border-muted)] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--orange)] font-extrabold text-white">{i + 1}</span>
                <h3 className="text-lg font-extrabold">{f.titulo}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ACTOR[f.actor]}`}>Actúa: {f.actor}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${f.madurez === 'existe' ? 'bg-[#1f9d6b]/15 text-[#146c49]' : 'bg-[#F5B800]/25 text-[#7a5b00]'}`}>{f.madurez === 'existe' ? 'Existe, se reordena' : 'Nuevo'}</span>
                <Link href={`/prototipo/recorrido?paso=${i + 1}`} className="ml-auto text-sm font-bold text-[var(--orange-dark)] underline">Verlo en el recorrido ›</Link>
              </div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo t="Aviso" v={f.aviso} />
                <Campo t="Botón" v={f.boton} />
                <Campo t="Aterriza en" v={f.aterriza} />
                <Campo t="Si no actúa" v={f.siNo} />
                <Campo t="Se registra" v={f.registra} />
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--text-light)]">Las etiquetas &quot;Existe&quot; y &quot;Nuevo&quot; salen de lo que se revisó en el código; se confirman flujo por flujo antes de construir.</p>
      </section>
    </main>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
