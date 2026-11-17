import Link from 'next/link'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import { CLASE_LISTA, Flecha, Rol, TituloSeccion } from '@/components/panel/ui'
import { Cifra } from '@/components/panel/confianza/piezas'
import type { CompitaHabilitada, ResumenOperativo } from '@/lib/confianza/operativo'

// Vista operativa del Sistema de Confianza: datos reales y SOLO LECTURA. Las fichas se abren con la ficha que ya existe en el panel
// (Personas), así no hay una segunda ficha del mismo compita. Las etapas intermedias siguen en el Centro Compitas V2.

const EN_WEB: Record<CompitaHabilitada['enWeb'], string> = { catalogo: 'En el catálogo', inactiva: 'Inactiva en la web', bloqueada: 'Bloqueada por el CMC' }

export default function ConfianzaOperativo({ r, fichaHref, urlV2 }: { r: ResumenOperativo; fichaHref: (id: string) => string; urlV2: string | null }) {
  const reales = r.habilitadas.filter((c) => !c.prueba)
  const pruebas = r.habilitadas.filter((c) => c.prueba)
  const enCatalogo = reales.filter((c) => c.enWeb === 'catalogo').length
  const porActivar = reales.filter((c) => c.enWeb === 'inactiva')
  const pruebaVisible = pruebas.filter((c) => c.enWeb === 'catalogo')
  const atencion = porActivar.length + pruebaVisible.length + r.postulaciones.porResolver

  return (
    <div className="space-y-4">
      <Aviso tamano="compacto" tono="info">
        Datos reales, solo lectura.{' '}
        {urlV2 ? <a href={urlV2} target="_blank" rel="noopener noreferrer" className="underline">Entrevistas, verificaciones y onboarding: Centro Compitas V2 ›</a> : 'Entrevistas, verificaciones y onboarding se registran en el Centro Compitas V2.'}
      </Aviso>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra valor={r.postulaciones.recibidas} texto="Postulaciones" info="Compitas que se registraron desde la web. No cuenta repetidas, spam ni perfiles de prueba." />
        <Cifra valor={reales.length} texto="Habilitadas" info="Compitas que el CMC habilitó (pasaron los 7 controles) y publicó en la web. No cuenta perfiles de prueba." />
        <Cifra valor={enCatalogo} texto="En el catálogo" info="Habilitadas reales que el equipo ya activó y verificó, con Telegram vinculado: las familias pueden pedirlas." />
        <Cifra valor={atencion} texto="Requieren atención" alerta={atencion > 0} info="Habilitadas sin activar, perfiles de prueba visibles al público y postulaciones por resolver." />
      </div>
      <p className="flex flex-wrap items-center gap-1 text-xs text-texto-sutil">
        No cuentan en las cifras: {pruebas.length + r.postulaciones.pruebas} de prueba · {r.postulaciones.repetidas} repetidas · {r.demos} perfiles demo del catálogo.
        <InfoBoton que="Qué no cuenta" texto="Los perfiles de prueba se reconocen por su código (lista en lib/confianza/operativo.ts), por palabras como prueba o test en el nombre o el correo, y por ser cuentas del equipo. Los perfiles demo son los de muestra del catálogo." />
      </p>

      {(pruebaVisible.length > 0 || porActivar.length > 0 || r.postulaciones.porResolver > 0) && (
        <section className="space-y-2">
          <TituloSeccion>Requieren atención</TituloSeccion>
          <ul className={CLASE_LISTA}>
            {pruebaVisible.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} conNota />)}
            {porActivar.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} conNota />)}
            {r.postulaciones.porResolver > 0 && (
              <li className="px-3 py-2.5 text-sm"><span className="font-bold">{r.postulaciones.porResolver} postulaciones por resolver.</span> <span className="text-texto-medio">Se revisan en Más, Postulaciones y origen.</span></li>
            )}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <TituloSeccion>Compitas habilitadas por el CMC</TituloSeccion>
        {r.habilitadas.length === 0 ? <p className="text-sm text-texto-medio">Todavía no hay ninguna.</p> : (
          <ul className={CLASE_LISTA}>{r.habilitadas.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} />)}</ul>
        )}
      </section>

      <Aviso tamano="compacto" tono="advertencia">
        Pendiente de integrar: las etapas intermedias (preseleccionado, entrevistado, en verificación) viven en el CMC y la web aún no las lee. Por eso aquí no se cuentan los aspirantes en evaluación.
      </Aviso>
      <p className="text-xs text-texto-sutil">
        Leído el {fecha(r.leidoEn)}.{r.ultimaSincronizacion ? ` Última publicación del CMC: ${fecha(r.ultimaSincronizacion.cuando)} (${r.ultimaSincronizacion.estado}).` : ''}
      </p>
    </div>
  )
}

function FilaHabilitada({ c, href, conNota = false }: { c: CompitaHabilitada; href: string; /** La nota se muestra solo en «Requieren atención», para no repetirla en la lista completa. */ conNota?: boolean }) {
  return (
    <li>
      <Link prefetch={false} href={href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-lavanda-sutil">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{c.nombre}</span><span className="text-xs text-texto-sutil">{c.codigo}</span>
            {c.prueba && <Rol>Prueba</Rol>}
            <span className="text-xs font-bold text-texto-medio">{EN_WEB[c.enWeb]}{c.telegram ? '' : ' · sin Telegram'}</span>
          </div>
          {conNota && c.nota && <p className={`text-xs ${c.prueba ? 'font-bold text-rojo-oscuro' : 'text-ambar-oscuro'}`}>{c.nota}</p>}
        </div>
        <Flecha />
      </Link>
    </li>
  )
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: false })
