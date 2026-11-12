import Link from 'next/link'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { EncabezadoLateral, TituloBloque } from '@/components/panel/ui'
import AccionCuenta from '@/components/panel/AccionCuenta'
import CerrarConEscape from '@/components/panel/CerrarConEscape'
import { PuntoUrgencia } from '@/components/panel/Personas'
import { TEXTO_SEMAFORO, tiempoEnEtapa } from '@/lib/panel-seguimiento-tipos'
import { ETIQUETA_ESPERA, type CasoCliente } from '@/lib/panel-caso-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'

const TEXTO_TIEMPO = { verde: 'text-texto-sutil', amarillo: 'text-ambar-oscuro', rojo: 'text-rojo-oscuro' } as const

// La ventana del CASO: la situación completa de un cliente y su compita, en un solo lugar. Desde aquí se va a cada ficha o al chat,
// con botones que dicen a dónde llevan. Es lo que se abre al tocar una fila de Seguimiento.
export default function CasoSeguimiento({ caso, cerrarHref, fichaClienteHref, fichaCompitaHref, chatHref, puedeAtender }: {
  caso: CasoCliente; cerrarHref: string; fichaClienteHref: string; fichaCompitaHref: string | null; chatHref: string | null; puedeAtender: boolean
}) {
  const sol = caso.solicitud
  const hayAcciones = puedeAtender && !!sol && sol.estado === 'aceptada'
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-negro/30">
      <CerrarConEscape href={cerrarHref} />
      <Link href={cerrarHref} replace scroll={false} aria-label="Cerrar el caso" className="absolute inset-0 cursor-default" />
      <aside role="dialog" aria-label={`Seguimiento de ${caso.nombre}`} className="relative h-full w-full max-w-md space-y-5 overflow-y-auto bg-blanco p-5 shadow-2xl">
        <EncabezadoLateral etiqueta="Seguimiento del caso" titulo={<>{caso.nombre || 'Sin nombre'}{caso.compita && <span className="font-bold text-texto-medio"> con {caso.compita}</span>}</>} cerrarHref={cerrarHref} />

        <section className="space-y-2 rounded-xl border border-borde p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PuntoUrgencia u={caso.urgencia} texto={TEXTO_SEMAFORO[caso.urgencia]} />
            <span className="rounded-full bg-gris100 px-2 py-0.5 text-xs font-bold text-texto-medio">Etapa: {caso.etapa}</span>
            <span className={`text-xs ${TEXTO_TIEMPO[caso.urgencia]}`}>{tiempoEnEtapa(caso.horas)} sin movimiento</span>
          </div>
          <p className="text-sm">{caso.que}</p>
          <p className={`text-xs font-extrabold uppercase tracking-wide ${caso.espera === 'equipo' ? 'text-rojo-oscuro' : 'text-texto-medio'}`}>{ETIQUETA_ESPERA[caso.espera]}</p>
        </section>

        {hayAcciones && sol && (
          <section className="space-y-2">
            <div className="flex items-center gap-1"><TituloBloque>Acciones</TituloBloque><InfoBoton que="Qué hacen estas acciones" texto="Para destrabar un caso a mano. Reenviar el enlace de la llamada vuelve a mandar el enlace a la familia y al compita (útil si no les llegó). Marcar como completada cierra la solicitud cuando la llamada ya ocurrió y no hay nada más que esperar." /></div>
            <div className="flex flex-wrap gap-2">
              {sol.conLlamada && <AccionCuenta texto="Reenviar enlace de llamada" url="/api/admin/enviar-link-llamada" cuerpo={{ solicitud_id: sol.id }} titulo="Reenviar el enlace de la llamada" mensaje="Se manda de nuevo el enlace de la llamada a la familia y al compita, por correo y Telegram." info="Vuelve a enviar el enlace de la llamada de presentación a los dos. No crea una llamada nueva si ya hay una sala." />}
              <AccionCuenta texto="Marcar como completada" url="/api/admin/completar-solicitud" cuerpo={{ id: sol.id }} titulo="Marcar la solicitud como completada" mensaje="La solicitud pasa a completada. Hazlo solo si la llamada ya ocurrió y no queda nada pendiente." info="Cierra esta solicitud como completada. Solo sirve si estaba aceptada." />
            </div>
          </section>
        )}
        <section className="space-y-2">
          <div className="flex items-center gap-1"><TituloBloque>Abrir</TituloBloque><InfoBoton que="Qué abre cada botón" texto="Ficha del cliente: sus datos, contacto, notas y su historial. Ficha del compita: lo mismo del compita. Chat: la conversación entre ambos (necesita el permiso de chats, y queda anotado). Ninguno cambia nada." /></div>
          <div className="flex flex-wrap gap-2">
            <Boton tamano="compacto" variante="secundario" navegacion href={fichaClienteHref}>Ficha del cliente</Boton>
            {fichaCompitaHref && <Boton tamano="compacto" variante="secundario" navegacion href={fichaCompitaHref}>Ficha del compita</Boton>}
            {chatHref && <Boton tamano="compacto" variante="secundario" navegacion href={chatHref}>Chat</Boton>}
          </div>
        </section>

        <section>
          <TituloBloque>Línea de tiempo</TituloBloque>
          {caso.linea.length === 0 ? <p className="mt-2 text-sm text-texto-sutil">Todavía no hay nada que contar.</p> : (
            <ol className="mt-3 border-l border-borde pl-4">
              {caso.linea.map((l, i) => (
                <li key={i} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-5 top-1.5 h-2 w-2 rounded-full bg-naranja" />
                  <p className="text-xs text-texto-sutil">{cuandoLinea(l.cuando)}</p>
                  <p className="text-sm [overflow-wrap:anywhere]">{l.texto}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  )
}
