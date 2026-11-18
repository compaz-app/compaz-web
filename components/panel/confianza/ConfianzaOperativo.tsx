import Link from 'next/link'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import { Cifra, EtiquetaAtencion, LISTA_CF, TarjetaCf } from '@/components/panel/confianza/piezas'
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
    <div className="space-y-5">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-verde-claro px-2.5 py-0.5 text-xs font-bold text-verde-oscuro">Datos reales · solo lectura</span>
        <span className="text-cf-texto-suave">Las entrevistas, verificaciones y el onboarding se registran en el Centro Compitas V2.</span>
        {urlV2 && <a href={urlV2} target="_blank" rel="noopener noreferrer" className="font-bold text-cf-morado underline">Abrir la V2 ›</a>}
      </p>

      <section aria-label="Resumen">
        <div className="grid grid-cols-2 divide-cf-borde sm:grid-cols-4 sm:divide-x">
          <Cifra valor={r.postulaciones.recibidas} texto="Postulaciones" detalle="Desde la web" info="Compitas que se registraron desde la web. No cuenta repetidas, spam ni perfiles de prueba." />
          <Cifra valor={reales.length} texto="Habilitadas" detalle="Pasaron los 7 controles" info="Compitas que el CMC habilitó y publicó en la web. No cuenta perfiles de prueba." />
          <Cifra valor={enCatalogo} texto="En el catálogo" detalle="Reciben solicitudes" info="Habilitadas reales que el equipo ya activó y verificó, con Telegram vinculado: las familias pueden pedirlas." />
          <Cifra valor={atencion} texto="Requieren atención" detalle="Ver abajo" tono={atencion > 0 ? 'atencion' : 'neutro'} info="Habilitadas sin activar, perfiles de prueba visibles al público y postulaciones por resolver." />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-cf-texto-suave">
          No cuentan en las cifras: {pruebas.length + r.postulaciones.pruebas} de prueba · {r.postulaciones.repetidas} repetidas · {r.demos} perfiles demo del catálogo.
          <InfoBoton que="Qué no cuenta" texto="Los perfiles de prueba se reconocen por su código (lista en lib/confianza/operativo.ts), por palabras como prueba o test en el nombre o el correo, y por ser cuentas del equipo. Se siguen mostrando en la lista, marcados, para poder revisarlos; los perfiles demo son los de muestra del catálogo." />
        </p>
      </section>

      {(pruebaVisible.length > 0 || porActivar.length > 0 || r.postulaciones.porResolver > 0) && (
        <section className="space-y-2">
          <h2 className="text-base font-extrabold">Requieren atención</h2>
          <ul className={LISTA_CF}>
            {pruebaVisible.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} conNota />)}
            {porActivar.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} conNota />)}
            {r.postulaciones.porResolver > 0 && (
              <li className="px-3 py-3 text-sm"><span className="font-bold">{r.postulaciones.porResolver} postulaciones por resolver.</span> <span className="text-cf-texto-suave">Se revisan en Más, Postulaciones y origen.</span></li>
            )}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="flex flex-wrap items-center gap-1 text-base font-extrabold">
          Compitas habilitadas por el CMC
          <span className="font-semibold text-cf-texto-suave">· {r.habilitadas.length} {r.habilitadas.length === 1 ? 'ficha' : 'fichas'}, {reales.length} {reales.length === 1 ? 'cuenta' : 'cuentan'} en las cifras</span>
          {pruebas.length > 0 && <InfoBoton que="Por qué hay más fichas que habilitadas" texto={`La lista muestra todas las fichas que el CMC publicó, también ${pruebas.length === 1 ? 'el perfil de prueba' : `los ${pruebas.length} perfiles de prueba`}, para poder revisarlos. Esos perfiles no cuentan en las cifras de arriba.`} />}
        </h2>
        {r.habilitadas.length === 0 ? <p className="text-sm text-cf-texto-suave">Todavía no hay ninguna.</p> : (
          <ul className={LISTA_CF}>{r.habilitadas.map((c) => <FilaHabilitada key={c.id} c={c} href={fichaHref(c.id)} />)}</ul>
        )}
      </section>

      <TarjetaCf>
        <Aviso tamano="compacto" tono="advertencia">Pendiente de integrar: las etapas intermedias (preselección, entrevista, verificación) viven en el CMC y la web aún no las lee. Por eso aquí no se cuentan los aspirantes en evaluación.</Aviso>
        <p className="text-xs text-cf-texto-suave">
          Leído el {fecha(r.leidoEn)}.{r.ultimaSincronizacion ? ` Última publicación del CMC: ${fecha(r.ultimaSincronizacion.cuando)}, ${r.ultimaSincronizacion.estado}.` : ''}
        </p>
      </TarjetaCf>
    </div>
  )
}

function FilaHabilitada({ c, href, conNota = false }: { c: CompitaHabilitada; href: string; /** La nota se muestra solo en «Requieren atención», para no repetirla en la lista completa. */ conNota?: boolean }) {
  return (
    <li>
      <Link prefetch={false} href={href} className="flex items-center gap-3 px-3 py-3 hover:bg-cf-lateral">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{c.nombre}</span><span className="text-xs text-cf-texto-suave">{c.codigo}</span>
            <span className="text-xs font-bold text-cf-texto-suave">· {EN_WEB[c.enWeb]}{c.telegram ? '' : ' · sin Telegram'}</span>
            {c.prueba && <span title={c.prueba}><EtiquetaAtencion estado="excluido" /></span>}
            {c.prueba && <span className="text-xs text-cf-texto-suave">perfil de prueba</span>}
          </div>
          {conNota && c.nota && <p className={`mt-0.5 text-xs ${c.prueba ? 'font-bold text-rojo-oscuro' : 'text-ambar-oscuro'}`}>{c.nota}</p>}
        </div>
        <span aria-hidden className="text-lg text-cf-texto-suave">›</span>
      </Link>
    </li>
  )
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: false })
