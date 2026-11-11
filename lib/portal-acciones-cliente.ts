// La parte PURA de las acciones del portal (sin base de datos ni código de servidor): la usa el botón del navegador.
// Cada acción usa una ruta que YA existe (o la nueva de avisar al equipo). Lo del servidor está en lib/portal-acciones.ts.

export type AccionPortal = 'avisar_pago' | 'confirmar_inicio' | 'avisar_abrieron' | 'avisar_equipo'

export interface PeticionAccion { url: string; metodo: 'POST'; cuerpo: Record<string, unknown> }

/** La llamada que hace cada botón de acción. `visitaId` es la visita del estado actual (la necesitan confirmar_inicio). */
export function peticionDeAccion(accion: AccionPortal, ctx: { visitaId?: string; estado?: string }): PeticionAccion | null {
  switch (accion) {
    case 'avisar_pago': return { url: '/api/pago/insistir', metodo: 'POST', cuerpo: {} }
    case 'confirmar_inicio': return ctx.visitaId ? { url: '/api/visita/confirmar-inicio', metodo: 'POST', cuerpo: { visitaId: ctx.visitaId } } : null
    case 'avisar_abrieron': return { url: '/api/visita/llegada', metodo: 'POST', cuerpo: { accion: 'ya_abro' } }
    case 'avisar_equipo': return { url: '/api/portal/avisar-equipo', metodo: 'POST', cuerpo: { estado: ctx.estado ?? '' } }
  }
}

