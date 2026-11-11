// Guía visual interna: los componentes base y los tokens, para revisar a 375, 768 y 1280 px. No existe en producción.
import { notFound } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import Aviso from '@/components/ui/base/Aviso'
import Pasos from '@/components/ui/base/Pasos'
import { colors } from '@/lib/design'
import TarjetaEstado from '@/components/portal/TarjetaEstado'
import { CODIGOS_ESTADO, pasoDe } from '@/lib/estado-cliente'
import { tarjetaDelEstado } from '@/lib/portal-estados'

export const metadata = { title: 'Guía visual', robots: { index: false, follow: false } }

export default function GuiaVisual() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-extrabold text-morado-profundo">Guía visual</h1>
      <p className="text-morado-claro">Lo que se usa para construir pantallas. Si necesitas algo que no está aquí, se agrega aquí primero.</p>

      <Tarjeta>
        <h2 className="text-lg font-extrabold text-morado-profundo">Colores (tokens)</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(colors).map(([k, v]) => (
            <li key={k} className="flex items-center gap-2 text-sm"><span aria-hidden className="h-6 w-6 shrink-0 rounded-md border border-borde" style={{ background: v }} /><span className="min-w-0 truncate font-semibold text-morado-claro">{k}</span></li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta tono="destacada">
        <h2 className="text-lg font-extrabold text-morado-profundo">Pasos</h2>
        <div className="mt-3"><Pasos pasos={['Elegir', 'Entrevista', 'Decidir', 'Pagar', 'Ficha', 'Visitas']} actual={2} /></div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-lg font-extrabold text-morado-profundo">Botones (toda acción lleva su ⓘ)</h2>
        <div className="mt-3 grid gap-3">
          <Boton info="Envía tu solicitud al compita. Todavía no se cobra nada.">Enviar solicitud</Boton>
          <Boton variante="secundario" info="Te lleva a elegir otro compita. No pagas nada por cambiar.">Elegir otro compita</Boton>
          <Boton variante="peligro" info="Cancela la visita. Con más de 24 horas de aviso es gratis.">Cancelar la visita</Boton>
          <Boton variante="primario" disabled info="Un botón deshabilitado se ve apagado y no se puede tocar.">Deshabilitado</Boton>
          <Boton variante="primario" cargando info="Mientras se envía, el botón avisa y no se puede tocar otra vez.">Enviando</Boton>
          <Boton variante="fantasma" href="/guia-visual" navegacion>Navegación pura (sin ⓘ)</Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-lg font-extrabold text-morado-profundo">Portal del cliente: los {CODIGOS_ESTADO.length} estados</h2>
        <p className="mt-1 text-morado-claro">Así se ve la tarjeta de cada estado, con datos de ejemplo. Los botones de acción salen apagados hasta el siguiente paso de la migración.</p>
        <div className="mt-4 grid gap-6">
          {CODIGOS_ESTADO.map((c) => {
            const estado = { codigo: c, paso: pasoDe(c), compitaNombre: 'María Pérez Gómez', solicitudId: 'ejemplo', cuando: new Date(Date.now() + 26 * 3600_000).toISOString() }
            const pagado = pasoDe(c) >= 3
            const t = tarjetaDelEstado({ estado, pagado, zonaCliente: 'America/New_York' })
            return (
              <div key={c}>
                <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-morado-sutil">{c} · paso {pasoDe(c) + 1}</div>
                <TarjetaEstado tarjeta={t} compita={pagado ? 'María Pérez' : 'María P.'} />
              </div>
            )
          })}
        </div>
      </Tarjeta>

      <Tarjeta tono="alerta">
        <h2 className="text-lg font-extrabold text-morado-profundo">Avisos</h2>
        <div className="mt-3 grid gap-3">
          <Aviso tono="info">Información: algo que conviene saber.</Aviso>
          <Aviso tono="exito">Listo: se guardó correctamente.</Aviso>
          <Aviso tono="advertencia">Atención: revisa esto antes de seguir.</Aviso>
          <Aviso tono="peligro">Problema: no se pudo completar.</Aviso>
        </div>
      </Tarjeta>
    </main>
  )
}
