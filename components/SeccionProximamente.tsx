import { TarjetasProximamente } from '@/components/ui/Proximamente'

// Página principal: lo que viene. Para quien visita (familias, compitas e inversionistas) que ve hacia dónde crece Compaz. Solo informa: sin enlaces.
export default function SeccionProximamente() {
  return (
    <section aria-labelledby="proximamente-titulo" className="bg-fondo-crudo px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-extrabold uppercase tracking-widest text-naranja-oscuro">Próximamente</p>
        <h2 id="proximamente-titulo" className="mt-2 text-center text-3xl font-extrabold text-morado-profundo md:text-4xl">Compaz sigue creciendo</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-texto-medio">Acompañar a quien lo necesita es solo el comienzo. Estas son las nuevas formas de estar cerca que estamos preparando.</p>
        <div className="mt-10"><TarjetasProximamente ids={['voluntariado', 'mascotas']} /></div>
      </div>
    </section>
  )
}
