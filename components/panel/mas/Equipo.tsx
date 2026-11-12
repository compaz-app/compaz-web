import { CLASE_LISTA, Rol, TituloSeccion } from '@/components/panel/ui'
import { InvitarColaborador, TarjetaColaborador } from '@/components/panel/mas/EquipoAcciones'
import InfoBoton from '@/components/ui/InfoBoton'
import { INFO_EQUIPO } from '@/lib/panel-equipo-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { DatosEquipo } from '@/lib/panel-equipo'

// Equipo y permisos (solo administradores): quién entra al panel y qué puede hacer cada uno.
export default function Equipo({ d }: { d: DatosEquipo }) {
  return (
    <section className="max-w-3xl space-y-5">
      <p className="flex items-center gap-1 text-sm text-texto-medio">Quién entra al panel y qué puede hacer cada uno.<InfoBoton que="Cómo funciona Equipo" texto={INFO_EQUIPO} /></p>

      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>Administradores</TituloSeccion><InfoBoton que="Cómo se agrega un administrador" texto="Los administradores tienen acceso total y no necesitan dar motivo. Se agregan o quitan SOLO en la variable ADMIN_EMAILS de Netlify (correos separados por coma) y hay que volver a desplegar. No se cambian desde aquí a propósito: así nadie puede darse acceso total con un clic." /></div>
        <ul className={CLASE_LISTA}>
          {d.admins.map((c) => <li key={c} className="flex items-center justify-between gap-2 px-3 py-2.5"><span className="truncate text-sm font-bold">{c}</span><Rol>Administrador</Rol></li>)}
          {!d.admins.length && <li className="p-4 text-sm text-texto-sutil">No hay administradores definidos en ADMIN_EMAILS.</li>}
        </ul>
      </div>

      <div className="space-y-2">
        <TituloSeccion>Colaboradores y sus permisos</TituloSeccion>
        <ul className={CLASE_LISTA}>
          {d.colaboradores.map((c) => <TarjetaColaborador key={c.correo} {...c} />)}
          {!d.colaboradores.length && <li className="p-6 text-center text-sm text-texto-sutil">Todavía no hay colaboradores. Invita al primero abajo.</li>}
        </ul>
      </div>

      <div className="space-y-2">
        <TituloSeccion>Invitar a un colaborador</TituloSeccion>
        <InvitarColaborador />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>Historial de cambios</TituloSeccion><InfoBoton que="Qué es el historial" texto="Cada alta, cambio de permisos y desactivación queda anotado con quién lo hizo y cuándo. Es de solo inserción: nadie puede editarlo ni borrarlo. Muestra los últimos 30 cambios." /></div>
        <ul className={CLASE_LISTA}>
          {d.historial.map((h, i) => (
            <li key={i} className="px-3 py-2 text-sm"><span className="block"><b>{h.correo}</b> <span className="text-texto-medio">{h.texto}</span></span><span className="text-xs text-texto-sutil">Por {h.por} · {cuandoLinea(h.cuando)}</span></li>
          ))}
          {!d.historial.length && <li className="p-6 text-center text-sm text-texto-sutil">Todavía no hay cambios.</li>}
        </ul>
      </div>
    </section>
  )
}
