import Chat from '@/components/ui/Chat'
import ChatColapsable from '@/components/ui/ChatColapsable'
import VideoCall from '@/components/ui/VideoCall'
import FechaProgramada from '@/components/ui/FechaProgramada'
import PreVisitaActions from '@/components/ui/PreVisitaActions'
import ReagendarButton from '@/components/ui/ReagendarButton'
import LlegadaVisita from '@/components/ui/LlegadaVisita'
import DireccionVisita from '@/components/ui/DireccionVisita'
import LugarPersonas from '@/components/ui/LugarPersonas'
import AgendarOtraVisita from '@/components/ui/AgendarOtraVisita'
import SeguimientoBienestar from '@/components/ui/SeguimientoBienestar'
import HistorialVisitas from '@/components/ui/HistorialVisitas'
import Tarjeta from '@/components/ui/base/Tarjeta'
import { bloquesDeVisitas, type BloqueVisitas } from '@/lib/portal-secciones'
import type { DatosPortal } from '@/lib/portal-datos'

// La pestaña Visitas: según la situación (qué bloques, en qué orden) la decide `bloquesDeVisitas`; aquí solo se dibujan, reutilizando los
// componentes que ya funcionan (chat, fecha, dirección...). Se van rehaciendo con el diseño nuevo uno por uno.
export default function SeccionVisitas({ d, vistaPrevia }: { d: DatosPortal; vistaPrevia: boolean }) {
  const visita = d.visitaActiva ?? d.visitaPreVisita ?? d.visitaProgramada
  const hayActiva = !!(d.visitaActiva || d.visitaPreVisita || d.visitaProgramada)
  const bloques = bloquesDeVisitas({
    visita: (visita?.estado as 'en_curso' | 'confirmando_inicio' | 'pre_visita' | 'programada' | undefined) ?? null,
    puedeAgendarOtra: !!d.compita && d.compita.estado === 'activo' && d.compita.verificado && !hayActiva && d.visitasPasadas.length > 0 && d.usuario?.plan !== 'bloqueado',
    visitasTerminadas: d.visitasPasadas.length, reportes: d.reportes.length, vistaPrevia,
  })
  const nombre = visita?.compita.nombre ?? d.compita?.nombre ?? 'tu compita'
  const dibujar = (b: BloqueVisitas) => {
    switch (b) {
      case 'video': return <VideoCall visitaId={d.visitaActiva!.id} compitaNombre={nombre} roomUrlInicial={d.visitaActiva?.room_url ?? null} />
      case 'chat': return <Chat visita={visita!} mensajesIniciales={d.mensajes} compitaNombre={nombre} />
      case 'fecha': return <div id="fecha-programada"><FechaProgramada visitaId={visita!.id} fechaActual={visita!.fecha_programada ?? null} horaInicioActual={visita!.hora_inicio_programada ?? null} horaFinActual={visita!.hora_fin_programada ?? null} compitaNombre={nombre} /></div>
      case 'acciones_coordinacion': return <PreVisitaActions compitaNombre={nombre} tieneFecha={!!visita!.fecha_programada} />
      case 'chat_plegable': return <ChatColapsable visita={visita!} mensajesIniciales={d.mensajes} compitaNombre={nombre} />
      case 'reagendar': return <ReagendarButton visitaId={visita!.id} compitaNombre={nombre} />
      case 'llegada': return <LlegadaVisita />
      case 'direccion': return <DireccionVisita />
      case 'lugar': return <LugarPersonas />
      case 'agendar_otra': return <AgendarOtraVisita compitaNombre={d.compita!.nombre} cupo={d.cupo} />
      case 'bienestar': return <SeguimientoBienestar reportes={d.reportes} compitaNombre={d.compita?.nombre ?? nombre} />
      case 'historial': return <HistorialVisitas visitas={d.visitasPasadas as never} compitaId={d.compita?.id ?? null} compitaNombre={d.compita?.nombre ?? null} />
      case 'vacio': return <Tarjeta><h2 className="text-xl font-extrabold text-morado-profundo">Aún no tienes visitas</h2><p className="mt-1 text-lg text-morado-claro">Cuando elijas a tu compita y confirmemos tu pago, podrás agendar tu primera visita aquí.</p></Tarjeta>
    }
  }
  return <div className="space-y-4">{bloques.map((b) => <div key={b}>{dibujar(b)}</div>)}</div>
}
