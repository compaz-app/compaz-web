// Lo que necesita la pantalla del portal del cliente (la ruta nueva /portal), y quién puede verla.
// El portal NUEVO reemplaza al viejo (/dashboard) por etapas: mientras el ajuste `portal_nuevo` esté en 0 solo el equipo lo ve, en vista previa
// de un cliente. Con el ajuste en 1, los clientes lo ven y el viejo deja de usarse.

import { cargarFoto, decidirEstado, PASOS_PORTAL, type EstadoCliente } from '@/lib/estado-cliente'
import { tarjetaDelEstado, nombreVisible, type TarjetaPortal } from '@/lib/portal-estados'
import { qRol } from '@/lib/links'

export type AccesoPortal = 'portal' | 'admin' | 'viejo'

/** A dónde va quien entra a /portal. Un administrador sin cliente que ver va a su panel; un cliente va al portal nuevo solo si ya está encendido. */
export function accesoPortal(p: { esAdmin: boolean; previewUid: string | null; portalNuevoActivo: boolean }): AccesoPortal {
  if (p.esAdmin) return p.previewUid ? 'portal' : 'admin'
  return p.portalNuevoActivo ? 'portal' : 'viejo'
}

export interface PortalCliente {
  nombre: string
  estado: EstadoCliente
  tarjeta: TarjetaPortal
  pasos: readonly string[]
  /** Nombre a mostrar del compita (corto antes de pagar) y su inicial, si hay uno en juego. */
  compita: string | null
  pagado: boolean
}

export async function cargarPortal(clienteId: string, ahora: Date = new Date()): Promise<PortalCliente> {
  const foto = await cargarFoto(clienteId, ahora)
  const estado = decidirEstado(foto)
  // Con un plan pagado (o un compita ya asignado) se ve el nombre completo; antes de pagar, solo el nombre y la inicial.
  const pagado = !!foto.compitaAsignado || foto.cupo !== null
  const rutaSala = estado.sala ? `/sala/${estado.sala}?${qRol(estado.sala, 'cliente')}` : undefined
  const tarjeta = tarjetaDelEstado({ estado, pagado, zonaCliente: foto.zonaHoraria, restantes: foto.cupo?.restantes, rutaSala })
  const nombreCompleto = estado.compitaNombre ?? foto.compitaAsignado?.nombre ?? null
  return { nombre: foto.nombre, estado, tarjeta, pasos: PASOS_PORTAL, pagado, compita: nombreCompleto ? nombreVisible(nombreCompleto, pagado) : null }
}
