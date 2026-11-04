'use client'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useUrlState } from '../../useUrlState'

// Formulario de solicitud (punto 6): tres entradas, una línea de "qué necesitan", nota opcional de 300
// caracteres, "¿lugar privado?", foto opcional. Sin horarios: se eligen después, entre los del compita.
const MODOS = [
  { id: 'entrevista', t: 'Hablar primero', d: 'Una videollamada de 20 minutos antes de decidir.' },
  { id: 'directa', t: 'Contratarlo directo', d: 'Sin entrevista. María acepta y tú pagas.' },
  { id: 'mandado', t: 'Mandado', d: 'Una diligencia puntual, tarifa plana de $22.' },
]
const QUE = ['Compañía y conversación', 'Acompañar a una cita o a misa', 'Paseo o ejercicio', 'Otra cosa']
const DURACIONES = ['15 minutos', '30 minutos', '1 hora']
const MAX_NOTA = 300

// Mismo criterio que el filtro real (lib/chat-moderacion.ts): números largos o correos.
const hayContacto = (t: string) => /\d[\d\s().+-]{7,}\d|@|arroba/i.test(t)

function Inner() {
  const [modo, setModo] = useUrlState('modo', 'directa')
  const m = MODOS.find((x) => x.id === modo) ?? MODOS[1]
  const [que, setQue] = useState<string>('')
  const [nota, setNota] = useState('')
  const [privado, setPrivado] = useState<'si' | 'no' | ''>('')
  const [duracion, setDuracion] = useState('')
  const [foto, setFoto] = useState(false)
  const [aviso, setAviso] = useState(0)
  const [enviada, setEnviada] = useState(false)

  const esMandado = m.id === 'mandado'
  const listo = (esMandado ? nota.trim().length > 0 && !!duracion : !!que) && !!privado

  const enviar = () => {
    if (hayContacto(nota) && aviso < 1) { setAviso(1); return }
    setEnviada(true)
  }

  if (enviada) {
    const sig = m.id === 'entrevista'
      ? 'María recibe tu solicitud por Telegram. Cuando acepte, eliges un horario para la videollamada entre los que ella tiene disponibles.'
      : m.id === 'directa'
        ? 'María recibe tu solicitud por Telegram y acepta primero. Si acepta, te avisamos y pasas al pago. Si no puede, eliges a otro compita sin haber pagado nada.'
        : 'Un compita disponible recibe tu mandado por Telegram. Te avisamos apenas lo acepte.'
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <div className="rounded-3xl border-2 border-[var(--orange)] bg-white p-6 text-center">
          <div className="text-3xl">✓</div>
          <h1 className="mt-1 text-2xl font-extrabold">Solicitud enviada</h1>
          <p className="mt-2 text-lg text-[var(--text-mid)]">{sig}</p>
          <p className="mt-2 text-base text-[var(--text-light)]">No necesitas hacer nada más. Si tarda, te avisamos y el equipo de Compaz insiste por ti.</p>
          <Link href={`/prototipo/cliente?estado=${m.id === 'directa' ? 'directa_enviada' : 'enviada'}`} className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Ir a mi portal</Link>
        </div>
      </main>
    )
  }

  const campo = 'mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg'
  const chip = (on: boolean) => `min-h-12 rounded-full px-4 text-base font-bold ${on ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <Link href="/prototipo/cliente/elegir" className="text-base font-bold text-[var(--text-mid)]">‹ Volver a los compitas</Link>
      <h1 className="mt-3 text-2xl font-extrabold">{esMandado ? 'Pide un mandado' : 'Pídele a María P.'}</h1>

      <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="Qué quieres hacer">
        {MODOS.map((x) => (
          <button key={x.id} role="tab" aria-selected={modo === x.id} onClick={() => { setModo(x.id); setAviso(0) }} className={`min-h-14 rounded-2xl px-2 text-sm font-extrabold leading-tight ${modo === x.id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>{x.t}</button>
        ))}
      </div>
      <p className="mt-2 text-base text-[var(--text-mid)]">{m.d}</p>

      <div className="mt-4 grid gap-5 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
        {esMandado ? (
          <>
            <label className="text-base font-bold">¿Qué quieres que haga?
              <textarea value={nota} maxLength={MAX_NOTA} onChange={(e) => { setNota(e.target.value); setAviso(0) }} placeholder="Por ejemplo: llevar unos papeles a una oficina en Chacao" className={`${campo} min-h-24 py-3 font-normal`} />
              <span className="text-sm font-normal text-[var(--text-light)]">{nota.length} de {MAX_NOTA}</span>
            </label>
            <div>
              <div className="text-base font-bold">¿Cuánto crees que tomaría?</div>
              <div className="mt-2 flex flex-wrap gap-2">{DURACIONES.map((d) => <button key={d} onClick={() => setDuracion(d)} aria-pressed={duracion === d} className={chip(duracion === d)}>{d}</button>)}</div>
              <p className="mt-2 text-sm text-[var(--text-mid)]">Tarifa plana de <b>$22</b> por mandado, dure lo que dure, hasta 1 hora. Las compras no pasan por Compaz: si hay que comprar algo, lo coordinas con el compita por el chat.</p>
              <p className="mt-1 text-sm text-[var(--text-mid)]">¿Va a tomar más de una hora? Escríbenos y lo organizamos aparte.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-base font-bold">¿Qué necesitan?</div>
              <div className="mt-2 flex flex-wrap gap-2">{QUE.map((q) => <button key={q} onClick={() => setQue(q)} aria-pressed={que === q} className={chip(que === q)}>{q}</button>)}</div>
            </div>
            <label className="text-base font-bold">Algo más que debamos saber <span className="font-normal text-[var(--text-light)]">(opcional)</span>
              <textarea value={nota} maxLength={MAX_NOTA} onChange={(e) => { setNota(e.target.value); setAviso(0) }} className={`${campo} min-h-24 py-3 font-normal`} />
              <span className="text-sm font-normal text-[var(--text-light)]">{nota.length} de {MAX_NOTA}</span>
            </label>
          </>
        )}

        {aviso === 1 && (
          <div role="alert" className="rounded-2xl bg-[#FEF3C7] p-4 text-base font-bold text-[#92400E]">
            Por seguridad, Compaz conecta todo dentro de la plataforma: no hace falta compartir teléfonos ni correos. Este es el primer aviso. Si vuelve a pasar, avisaremos al equipo de Compaz.
            <div className="mt-1 text-sm font-normal">Quita el contacto de tu mensaje y vuelve a enviar. Si lo envías igual, se borra solo.</div>
          </div>
        )}

        <div>
          <div className="text-base font-bold">¿Tu familiar estará en una casa u otro lugar privado?</div>
          <div className="mt-2 flex gap-2">{(['si', 'no'] as const).map((v) => <button key={v} onClick={() => setPrivado(v)} aria-pressed={privado === v} className={`${chip(privado === v)} flex-1`}>{v === 'si' ? 'Sí' : 'No'}</button>)}</div>
          <p className="mt-2 text-sm text-[var(--text-mid)]">{privado === 'si' ? 'Entonces te pediremos la dirección y cómo entrar después de pagar, cuando agendes la cita. El compita la recibe solo 3 horas antes.' : 'Si el servicio es en la calle, en una iglesia o en un local, no te pedimos más.'}</p>
        </div>

        <div>
          <div className="text-base font-bold">Tu foto <span className="font-normal text-[var(--text-light)]">(opcional)</span></div>
          <p className="mt-1 text-sm text-[var(--text-mid)]">Tu foto es opcional, pero ayuda mucho: los compitas aceptan con más confianza a quien pueden ver. Solo la ve el compita al decidir.</p>
          <button onClick={() => setFoto((f) => !f)} className={`mt-2 min-h-12 w-full rounded-2xl border-2 text-base font-extrabold ${foto ? 'border-[#1f9d6b] bg-[#1f9d6b]/10 text-[#146c49]' : 'border-dashed border-[var(--border-muted)] text-[var(--text-mid)]'}`}>{foto ? '✓ Foto agregada (tocar para quitar)' : '📷 Agregar mi foto'}</button>
        </div>

        <div className="rounded-2xl bg-[var(--warm-gray)] p-4 text-base">
          <div className="font-bold">Sobre tu familiar</div>
          <p className="mt-1 text-[var(--text-mid)]">Elena, 82 años, hipertensión y usa bastón. Ya lo tenemos guardado; no lo escribes otra vez.</p>
          <Link href="/prototipo/cliente?sec=familiar" className="mt-1 inline-block font-bold text-[var(--orange-dark)] underline">Editar</Link>
        </div>

        <button disabled={!listo} onClick={enviar} className="min-h-14 rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">
          {m.id === 'entrevista' ? 'Pedir la videollamada' : m.id === 'directa' ? 'Enviar mi solicitud' : 'Pedir el mandado'}
        </button>
        {!listo && <p className="-mt-3 text-center text-sm text-[var(--text-light)]">{esMandado ? 'Cuéntanos qué necesitas, cuánto tomaría y si es un lugar privado.' : 'Elige qué necesitan y si es un lugar privado.'}</p>}
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
