// Panel nuevo del equipo. Reemplazará a /admin (el prototipo aprobado es app/prototipo/admin).
// Todo el estado vive en la dirección: ?sec= (sección), ?como=colaborador (solo administrador), y por sección:
//   bandeja: tipo, ver · personas: lista, q, vista, orden, dir, pag · seguimiento: etapa, pag · visitas: vv, pv
//   en cualquier sección: persona=<tipo>:<id> abre la ficha, chat=<cliente>:<compita> abre el chat; en seguimiento, caso=<cliente> abre el caso.
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { actorDePagina, type Actor } from '@/lib/permisos'
import { actorComo, puedeEntrarAlPanel, seccionActiva, type SeccionPanel, type ActorVista } from '@/lib/panel-secciones'
import EsqueletoPanel from '@/components/panel/EsqueletoPanel'
import { cargarBandeja, TOPE_BANDEJA } from '@/lib/panel-bandeja'
import AvisoTope from '@/components/panel/AvisoTope'
import MarcoPanel from '@/components/panel/MarcoPanel'
import Bandeja from '@/components/panel/Bandeja'
import Aviso from '@/components/ui/base/Aviso'
import Boton from '@/components/ui/base/Boton'
import FichaPersona from '@/components/panel/FichaPersona'
import VerChat from '@/components/panel/VerChat'
import Seguimiento from '@/components/panel/Seguimiento'
import CasoSeguimiento from '@/components/panel/CasoSeguimiento'
import { casoDeCliente } from '@/lib/panel-caso'
import { leerCasoUrl } from '@/lib/panel-caso-tipos'
import Visitas from '@/components/panel/Visitas'
import Link from 'next/link'
import Hub from '@/components/panel/mas/Hub'
import Actividad from '@/components/panel/mas/Actividad'
import Limites from '@/components/panel/mas/Limites'
import Manual from '@/components/panel/mas/Manual'
import Estado from '@/components/panel/mas/Estado'
import Resenas from '@/components/panel/mas/Resenas'
import Pagos from '@/components/panel/mas/Pagos'
import Postulaciones from '@/components/panel/mas/Postulaciones'
import Invitar from '@/components/panel/mas/Invitar'
import { listarPostulaciones, pendientesDeAirtable } from '@/lib/panel-postulaciones'
import { consultarPostulaciones } from '@/lib/panel-postulaciones-tipos'
import Avisos from '@/components/panel/mas/Avisos'
import Cobertura from '@/components/panel/mas/Cobertura'
import Equipo from '@/components/panel/mas/Equipo'
import Ajustes from '@/components/panel/mas/Ajustes'
import { datosDeAjustes } from '@/lib/panel-ajustes'
import { datosDeEquipo } from '@/lib/panel-equipo'
import { cargarCobertura, listarAvisos, listarPagosRecientes, listarResenas } from '@/lib/panel-mas-datos'
import { subMasActiva, filtrosActividad, CATEGORIAS_ACCESO } from '@/lib/panel-mas-tipos'
import { listarActividad } from '@/lib/panel-actividad'
import { catalogoEsperas } from '@/lib/esperas-catalogo'
import { estadoDelSistema } from '@/lib/panel-estado'
import { retencionDelSistema } from '@/lib/retencion'
import { getAjustes } from '@/lib/ajustes'
import { Selector, TablaClientes, TablaCompitas } from '@/components/panel/Personas'
import { fichaDePersona, listarClientes, listarCompitas, LIMITE as LIMITE_PERSONAS } from '@/lib/panel-personas'
import { consultarClientes, consultarCompitas, DESCRIPCION_PERSONAS, INFO_PERSONAS, leerChatUrl, leerPersonaUrl } from '@/lib/panel-personas-tipos'
import { Encabezado } from '@/components/panel/ui'
import { listarSeguimiento } from '@/lib/panel-seguimiento'
import { consultarSeguimiento, umbralesDeAjustes } from '@/lib/panel-seguimiento-tipos'
import { detalleDeVisita, listarVisitas, MAX_VISITAS } from '@/lib/panel-visitas'
import DetalleVisita from '@/components/panel/DetalleVisita'
import { consultarVisitas, leerVisitaUrl } from '@/lib/panel-visitas-tipos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Panel', robots: { index: false, follow: false } }

/** Qué parámetros de la dirección pertenecen a cada sección (los demás se descartan al cambiar de sección). */
const CLAVES: Record<string, string[]> = {
  personas: ['lista', 'q', 'vista', 'orden', 'dir', 'pag', 'estado'],
  seguimiento: ['etapa', 'pag'],
  visitas: ['vv', 'pv'],
  mas: ['mas', 'act_nivel', 'act_dias', 'act_q', 'act_pag', 'lim', 'man_q', 'man_sec', 'man_abierta', 'reg_dias', 'reg_q', 'reg_pag', 'res_ver', 'po_tipo', 'po_clasif', 'po_pag', 'pag_ver', 'pag_pag', 'av_ver', 'av_pag'],
}
const COMUNES = ['persona', 'chat', 'caso', 'visita']

export default async function PanelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth()
  const real = await actorDePagina()
  if (!real) redirect('/dashboard')
  const sp = await searchParams
  // Al cambiar cualquier parámetro de la dirección, el contenido se vuelve a pedir y mientras tanto se ve el esqueleto (el marco no se mueve).
  const clave = JSON.stringify(sp)
  const un = (k: string) => { const v = sp[k]; return typeof v === 'string' ? v : '' }
  const { actor, comoColaborador } = actorComo(real, un('como'))
  // Quien no tiene ningún permiso de trabajo vuelve a su cuenta, igual que en el panel viejo.
  if (!puedeEntrarAlPanel(actor)) redirect('/dashboard')
  const actual = seccionActiva(actor, un('sec'))
  // Viendo como colaborador, los datos se recortan como se le recortarían a él (así el administrador ve lo mismo que el equipo).
  const comoActor = { ...real, rol: actor.rol, permisos: actor.permisos }

  return (
    <MarcoPanel actor={actor} actual={actual} comoColaborador={comoColaborador} puedeElegirVista={real.rol === 'admin'} correo={real.correo}>
      {comoColaborador && <div className="mb-4"><Aviso tamano="compacto" tono="advertencia">Estás viendo el panel como un colaborador con los permisos base. Es solo la pantalla: tus permisos reales no cambian.</Aviso></div>}
      <Suspense key={clave} fallback={<EsqueletoPanel />}>
        <ContenidoPanel sp={sp} actual={actual} actor={actor} comoActor={comoActor} comoColaborador={comoColaborador} />
      </Suspense>
    </MarcoPanel>
  )
}

/** Lo que depende de la base: se calcula aparte para que el marco del panel (menú y encabezado) salga al instante y esto llegue después. */
async function ContenidoPanel({ sp, actual, actor, comoActor, comoColaborador }: {
  sp: Record<string, string | string[] | undefined>; actual: SeccionPanel; actor: ActorVista; comoActor: Actor; comoColaborador: boolean
}) {
  const un = (k: string) => { const v = sp[k]; return typeof v === 'string' ? v : '' }
  // Cada enlace parte de la dirección actual y cambia solo lo suyo.
  const enlace = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams({ sec: actual, ...(comoColaborador ? { como: 'colaborador' } : {}) })
    for (const k of [...(CLAVES[actual] ?? []), ...COMUNES]) { const v = un(k); if (v) q.set(k, v) }
    for (const [k, v] of Object.entries(cambios)) { if (v === null) q.delete(k); else q.set(k, v) }
    return `/panel?${q.toString()}`
  }

  let cuerpo: React.ReactNode = null
  let avisoTope: React.ReactNode = null
  if (actual === 'bandeja') {
    const tareas = await cargarBandeja(comoActor)
    cuerpo = <div className="space-y-3"><AvisoTope cargadas={tareas.length} tope={TOPE_BANDEJA} que="las tareas" /><Suspense><Bandeja tareas={tareas} puedeAtender={actor.permisos.atender === true} pideMotivo={actor.rol !== 'admin'} /></Suspense></div>
  } else if (actual === 'personas') {
    const baseForm: Record<string, string> = comoColaborador ? { como: 'colaborador' } : {}
    const lista = un('lista') === 'clientes' ? 'clientes' : 'compitas'
    if (lista === 'compitas') {
      const todas = await listarCompitas()
      avisoTope = <AvisoTope cargadas={todas.length} tope={LIMITE_PERSONAS} que="los compitas" />
      const c = consultarCompitas(todas, { q: un('q'), vista: un('vista'), orden: un('orden'), dir: un('dir'), pag: un('pag'), estado: un('estado') })
      cuerpo = <TablaCompitas enlace={enlace} params={baseForm} d={{ fila: c.fila, total: c.total, paginas: c.paginas, pag: c.pag, conteos: c.conteos, vista: c.vista.id, orden: un('orden'), dir: un('dir') === 'desc' ? 'desc' : 'asc', q: un('q'), enTotal: todas.length, estados: c.estados, estado: c.estado }} />
    } else {
      const todos = await listarClientes()
      avisoTope = <AvisoTope cargadas={todos.length} tope={LIMITE_PERSONAS} que="los clientes" />
      cuerpo = <TablaClientes enlace={enlace} params={baseForm} d={{ ...consultarClientes(todos, un('q'), un('pag'), un('estado')), q: un('q'), enTotal: todos.length }} />
    }
    cuerpo = <div className="space-y-3"><Encabezado titulo="Personas" descripcion={DESCRIPCION_PERSONAS} info={INFO_PERSONAS} infoQue="Para qué sirve Personas" /><Selector lista={lista} enlace={enlace} />{avisoTope}{cuerpo}</div>
  } else if (actual === 'seguimiento') {
    cuerpo = <Seguimiento enlace={enlace} d={{ ...consultarSeguimiento(await listarSeguimiento(), un('etapa'), un('pag')), umbrales: umbralesDeAjustes(await getAjustes()) }} />
  } else if (actual === 'visitas') {
    const ahora = Date.now()
    const todasVisitas = await listarVisitas(ahora)
    cuerpo = <div className="space-y-3"><AvisoTope cargadas={todasVisitas.length} tope={MAX_VISITAS} que="las visitas" /><Visitas enlace={enlace} puedeChats={actor.permisos.chats === true} d={{ ...consultarVisitas(todasVisitas, un('vv'), un('pv'), ahora), ahora }} /></div>
  } else {
    const subMas = subMasActiva(actor, un('mas'))
    const sinSub = Object.fromEntries(CLAVES.mas.map((k) => [k, null])) as Record<string, string | null>
    if (!subMas) {
      cuerpo = <Hub actor={actor} enlace={(c) => enlace({ ...sinSub, ...c })} />
    } else {
      const base: Record<string, string> = { sec: 'mas', mas: subMas.id, ...(comoColaborador ? { como: 'colaborador' } : {}) }
      let vista: React.ReactNode = null
      const retencion = retencionDelSistema(await getAjustes())
      const plazoDe = (id: string) => retencion.find((r) => r.id === id)?.plazo ?? ''
      if (subMas.id === 'actividad') {
        const f = filtrosActividad({ nivel: un('act_nivel'), dias: un('act_dias'), q: un('act_q'), pag: un('act_pag') })
        const r = await listarActividad(comoActor, f)
        vista = <Actividad plazo={plazoDe('actividad')} pre="act" enlace={enlace} paramsForm={{ ...base, ...(f.nivel ? { act_nivel: f.nivel } : {}), act_dias: String(f.dias) }} d={{ ...r, ...f }} />
      } else if (subMas.id === 'registro') {
        const f = filtrosActividad({ dias: un('reg_dias'), q: un('reg_q'), pag: un('reg_pag') }, 30)
        const r = await listarActividad(comoActor, { ...f, nivel: '', categorias: CATEGORIAS_ACCESO })
        vista = <Actividad plazo={plazoDe('accesos')} pre="reg" acceso enlace={enlace} paramsForm={{ ...base, reg_dias: String(f.dias) }} d={{ ...r, ...f }} />
      } else if (subMas.id === 'limites') {
        vista = <Limites filas={await catalogoEsperas()} quien={un('lim')} enlace={enlace} />
      } else if (subMas.id === 'manual') {
        vista = <Manual retencion={retencion} actor={actor} q={un('man_q').trim().slice(0, 100)} sec={un('man_sec')} abierta={un('man_abierta')} enlace={enlace} como={comoColaborador} paramsForm={base} />
      } else if (subMas.id === 'resenas') {
        vista = <Resenas filas={await listarResenas(comoActor)} ver={un('res_ver') === 'publicadas' ? 'publicadas' : 'pendientes'} enlace={enlace} puedeActuar={actor.permisos.atender === true} />
      } else if (subMas.id === 'invitar') {
        vista = <Invitar />
      } else if (subMas.id === 'postulaciones') {
        vista = <Postulaciones q={consultarPostulaciones(await listarPostulaciones(), un('po_tipo'), un('po_clasif'), un('po_pag'))} pend={await pendientesDeAirtable()} enlace={enlace} />
      } else if (subMas.id === 'pagos') {
        vista = <Pagos filas={await listarPagosRecientes()} ver={un('pag_ver') === 'anulados' ? 'anulados' : 'activos'} pagina={un('pag_pag')} enlace={enlace} />
      } else if (subMas.id === 'avisos') {
        vista = <Avisos filas={await listarAvisos(comoActor)} ver={un('av_ver') === 'fallidos' ? 'fallidos' : 'todos'} pagina={un('av_pag')} enlace={enlace} puedeReintentar={actor.permisos.atender === true} />
      } else if (subMas.id === 'ajustes' || subMas.id === 'umbrales') {
        vista = <Ajustes d={await datosDeAjustes()} puedeEditar={actor.permisos.ajustes_editar === true} esAdmin={actor.rol === 'admin'} semaforo={subMas.id === 'umbrales'} />
      } else if (subMas.id === 'equipo') {
        vista = <Equipo d={await datosDeEquipo()} />
      } else if (subMas.id === 'cobertura') {
        vista = <Cobertura filas={await cargarCobertura()} />
      } else if (subMas.id === 'estado') {
        const ahora = Date.now()
        vista = <Estado e={await estadoDelSistema(ahora, comoActor)} ahora={ahora} puedeReintentar={actor.permisos.atender === true} esAdmin={actor.rol === 'admin'} />
      } else {
        vista = <Aviso tamano="compacto" tono="info">Esa herramienta no existe. Elige una del menú de Más.</Aviso>
      }
      cuerpo = (
        <div className="space-y-3">
          <Link prefetch={false} href={enlace({ ...sinSub })} className="inline-flex min-h-9 items-center rounded-lg border border-borde bg-blanco px-3 text-sm font-bold">‹ Volver a Más</Link>
          <Encabezado titulo={subMas.texto} />
          {vista}
        </div>
      )
    }
  }

  // La ficha y el chat se abren encima de cualquier sección.
  const abierta = leerPersonaUrl(un('persona'))
  const datosFicha = abierta ? await fichaDePersona(comoActor, abierta.tipo, abierta.id) : null
  const chat = actor.permisos.chats === true ? leerChatUrl(un('chat')) : null
  const visitaId = actual === 'visitas' ? leerVisitaUrl(un('visita')) : null
  const detalle = visitaId ? await detalleDeVisita(comoActor, visitaId) : null
  const casoId = actual === 'seguimiento' ? leerCasoUrl(un('caso')) : null
  const caso = casoId ? await casoDeCliente(comoActor, casoId) : null

  return (
    <>
      {cuerpo}
      {detalle && (
        <DetalleVisita puedeAtender={actor.permisos.atender === true} d={detalle} ahora={Date.now()} cerrarHref={enlace({ visita: null })} fichaClienteHref={enlace({ persona: `cliente:${detalle.fila.clienteId}` })} fichaCompitaHref={enlace({ persona: `compita:${detalle.fila.compitaId}` })}
          chatHref={actor.permisos.chats === true ? enlace({ chat: `${detalle.fila.clienteId}:${detalle.fila.compitaId}` }) : null} />
      )}
      {caso && (
        <CasoSeguimiento puedeAtender={actor.permisos.atender === true} caso={caso} cerrarHref={enlace({ caso: null })} fichaClienteHref={enlace({ persona: `cliente:${caso.id}` })}
          fichaCompitaHref={caso.compitaId ? enlace({ persona: `compita:${caso.compitaId}` }) : null}
          chatHref={actor.permisos.chats === true && caso.compitaId ? enlace({ chat: `${caso.id}:${caso.compitaId}` }) : null} />
      )}
      {datosFicha && (
        <FichaPersona ficha={datosFicha} cerrarHref={enlace({ persona: null })} pideMotivo={actor.rol !== 'admin'} puedeContacto={actor.permisos.telefonos === true} puedeNotas={actor.permisos.atender === true} puedeCuentas={actor.permisos.cuentas === true} puedeEliminar={actor.rol === 'admin'}
          chatHref={actor.permisos.chats === true && datosFicha.tipo === 'cliente' && datosFicha.compitaId ? enlace({ persona: null, chat: `${datosFicha.id}:${datosFicha.compitaId}` }) : null} />
      )}
      {chat && <VerChat key={`${chat.clienteId}:${chat.compitaId}`} clienteId={chat.clienteId} compitaId={chat.compitaId} cerrarHref={enlace({ chat: null })} pideMotivo={actor.rol !== 'admin'}
        fichaClienteHref={enlace({ chat: null, persona: `cliente:${chat.clienteId}` })} fichaCompitaHref={enlace({ chat: null, persona: `compita:${chat.compitaId}` })} />}
    </>
  )
}
