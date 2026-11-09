'use client'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useUrlState } from '../../useUrlState'

type Perfil = { id: string; nombre: string; zona: string; rating: number; resenas: number; visitas: number; servicios: string[]; descripcion: string; video: boolean; disponible: boolean }

const SERVICIOS = ['Compañía y conversación', 'Acompañamiento a citas', 'Ayuda con medicinas', 'Paseos', 'Lectura y juegos']
const ZONAS = ['Todas las zonas', 'Chacao', 'Altamira', 'Los Palos Grandes', 'El Rosal', 'La Castellana']
const NOMBRES = ['María', 'Rosa', 'Daniela', 'Carmen', 'Yoselin', 'Gladys', 'Mariela', 'Beatriz', 'Irene', 'Dayana', 'Karina', 'Zuleima']
const PERFILES: Perfil[] = NOMBRES.map((nombre, i) => ({
  id: `c${i}`,
  nombre,
  zona: ZONAS[1 + (i % 5)],
  rating: Math.round((4.2 + ((i * 7) % 9) / 10) * 10) / 10,
  resenas: 3 + ((i * 5) % 14),
  visitas: 4 + ((i * 11) % 40),
  servicios: SERVICIOS.filter((_, k) => (i + k) % 2 === 0).slice(0, 3),
  descripcion: 'Me encanta conversar con los abuelos, escuchar sus historias y que se sientan acompañados. Tengo experiencia cuidando a mi propia abuela.',
  video: i % 3 !== 0,
  disponible: i % 4 !== 3,
}))
const MAX = 3
const INICIALES = ['P', 'G', 'R', 'M', 'S', 'C', 'O', 'N', 'Q', 'V', 'L', 'A']
// Antes de pagar el cliente ve solo el primer nombre y la inicial del apellido (decisión del punto 2).
const etq = (p: Perfil) => `${p.nombre} ${INICIALES[Number(p.id.slice(1)) % INICIALES.length]}.`

function Inner() {
  const [zona, setZona] = useUrlState('zona', ZONAS[0])
  const [orden, setOrden] = useUrlState('orden', 'rating')
  const [soloVideo, setSoloVideo] = useUrlState('video', '0')
  const [sel, setSel] = useUrlState('perfil', '')
  const [enviadas] = useState<string[]>(['c1'])
  
  const lista = useMemo(() => {
    const l = PERFILES.filter((p) => (zona === ZONAS[0] || p.zona === zona) && (soloVideo !== '1' || p.video))
    return [...l].sort((a, b) => (orden === 'visitas' ? b.visitas - a.visitas : b.rating - a.rating))
  }, [zona, orden, soloVideo])
  const p = PERFILES.find((x) => x.id === sel)

  // Al abrir un perfil se reinicia el paso y los horarios (en el clic, no en un efecto).
  const abrir = (id: string) => setSel(id)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [setSel])

  const yaPedida = p ? enviadas.includes(p.id) : false
  const lleno = enviadas.length >= MAX

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <Link href="/prototipo/cliente?estado=enviada" className="text-base font-bold text-[var(--text-mid)]">‹ Volver a mi portal</Link>



      <h1 className="mt-5 text-2xl font-extrabold">Elige tu compita</h1>
      <p className="text-lg text-[var(--text-mid)]">Habla primero con hasta {MAX} compitas, o contrata directo al que más te guste.</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--warm-gray)]"><div className="h-full bg-[var(--orange)]" style={{ width: `${(enviadas.length / MAX) * 100}%` }} /></div>
      <p className="mt-1 text-sm font-bold text-[var(--text-mid)]">{enviadas.length} de {MAX} solicitudes enviadas</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <select value={zona} onChange={(e) => setZona(e.target.value)} aria-label="Zona" className="min-h-12 rounded-xl border border-[var(--border-muted)] bg-white px-2 text-base">{ZONAS.map((z) => <option key={z}>{z}</option>)}</select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar" className="min-h-12 rounded-xl border border-[var(--border-muted)] bg-white px-2 text-base"><option value="rating">Mejor calificados</option><option value="visitas">Con más visitas</option></select>
      </div>
      <button onClick={() => setSoloVideo(soloVideo === '1' ? '0' : '1')} aria-pressed={soloVideo === '1'} className={`mt-2 min-h-10 rounded-full px-4 text-sm font-bold ${soloVideo === '1' ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>🎥 Con video de presentación</button>

      <ul className="mt-4 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {lista.map((x) => (
          <li key={x.id}>
            <button onClick={() => abrir(x.id)} className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--warm-gray)]">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-xl font-extrabold text-white">{x.nombre[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold">{etq(x)}</div>
                <div className="truncate text-sm text-[var(--text-mid)]">{x.zona} · {x.visitas} visitas</div>
                <div className="text-sm font-bold"><span className="text-[var(--orange)]">★</span> {x.rating.toFixed(1)} <span className="font-normal text-[var(--text-light)]">({x.resenas})</span>{x.video && ' · 🎥'}</div>
              </div>
              {enviadas.includes(x.id) ? <span className="shrink-0 rounded-full bg-[var(--yellow)] px-2 py-0.5 text-xs font-bold">Pedida</span> : <span className="text-2xl text-[var(--text-light)]">›</span>}
            </button>
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-[var(--text-light)]">No hay compitas con estos filtros</li>}
      </ul>

      {p && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-3xl font-extrabold text-white">{p.nombre[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-extrabold">{etq(p)}</div>
                <div className="text-[var(--text-mid)]">{p.zona}</div>
                <div className="font-bold"><span className="text-[var(--orange)]">★</span> {p.rating.toFixed(1)} · {p.visitas} visitas</div>
              </div>
              <button onClick={() => setSel(null)} aria-label="Cerrar" className="min-h-10 rounded-xl border border-[var(--border-muted)] px-3 font-bold">Cerrar</button>
            </div>

            {(
              <>
                <p className="mt-4 text-lg leading-relaxed text-[var(--text-mid)]">{p.descripcion}</p>
                <div className="mt-3 flex flex-wrap gap-2">{p.servicios.map((s) => <span key={s} className="rounded-full bg-[var(--warm-gray)] px-3 py-1 text-sm font-bold">{s}</span>)}</div>
                {p.video && <button className="mt-3 min-h-12 w-full rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">🎥 Ver video de presentación</button>}
                <div className="mt-4 rounded-2xl bg-[var(--warm-gray)] p-3 text-base"><b>Reseñas de familias</b><p className="mt-1 text-[var(--text-mid)]">“Mi mamá la adora, siempre puntual.” · “Muy cariñosa y atenta.”</p></div>
                {yaPedida ? (
                  <p className="mt-4 rounded-2xl bg-[var(--yellow)] p-3 text-center text-lg font-extrabold">Ya le escribiste a {p.nombre}</p>
                ) : lleno ? (
                  <p className="mt-4 rounded-2xl bg-[var(--warm-gray)] p-3 text-center text-base font-bold">Ya enviaste las {MAX} solicitudes. Espera una respuesta para pedir otra.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    <Link href={`/prototipo/cliente/solicitar?modo=entrevista&compita=${p.id}`} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-[var(--purple)] bg-white text-lg font-extrabold text-[var(--purple)]">Hablar primero (20 min)</Link>
                    <Link href={`/prototipo/cliente/solicitar?modo=directa&compita=${p.id}`} className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Contratarlo directo</Link>
                    <Link href={`/prototipo/cliente/solicitar?modo=mandado&compita=${p.id}`} className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border-muted)] bg-white font-bold text-[var(--text-mid)]">¿Solo una diligencia? Pedirle un mandado ($22)</Link>
                    <p className="text-center text-sm text-[var(--text-mid)]">Ves su foto, su video y sus reseñas ahora. Su apellido completo lo ves cuando la contratación esté confirmada.</p>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </main>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
