// Cuánto tiempo se guarda cada cosa. UN solo lugar para que el administrador lo sepa (el manual lo muestra) y no dependa de acordarse.
// Los plazos editables salen de Ajustes; los fijos están aquí. Una prueba comprueba que la limpieza diaria usa estas mismas claves.
import type { Ajustes } from '@/lib/ajustes'

export interface FilaRetencion { id: string; que: string; plazo: string; dondeCambia: string }

const dias = (n: unknown) => { const d = Number(n); return d % 365 === 0 && d >= 365 ? `${d / 365} ${d / 365 === 1 ? 'año' : 'años'} (${d} días)` : `${d} días` }

export function retencionDelSistema(a: Pick<Ajustes, 'avisos_retencion_dias' | 'accesos_retencion_dias' | 'foto_retencion_dias'>): FilaRetencion[] {
  return [
    { id: 'accesos', que: 'Accesos a datos sensibles: quién vio un teléfono, un correo o un chat, cuándo y por qué (Más, Registro de accesos)', plazo: dias(a.accesos_retencion_dias), dondeCambia: 'Más, Ajustes' },
    { id: 'actividad', que: 'El resto de la actividad del equipo (Más, Actividad)', plazo: dias(a.avisos_retencion_dias), dondeCambia: 'Más, Ajustes' },
    { id: 'avisos', que: 'Registro de avisos enviados a clientes y compitas (Más, Avisos enviados)', plazo: dias(a.avisos_retencion_dias), dondeCambia: 'Más, Ajustes' },
    { id: 'fotos', que: 'Fotos privadas de llegada, del cliente y del familiar', plazo: dias(a.foto_retencion_dias), dondeCambia: 'Más, Ajustes' },
    { id: 'notas', que: 'Notas internas de las fichas (con el nombre de quien las escribió)', plazo: 'No se borran solas', dondeCambia: 'No se puede cambiar desde el panel' },
    { id: 'cuentas', que: 'Cuenta que el cliente pide eliminar: se desactiva y se borra su información personal. Pagos y visitas quedan anonimizados', plazo: '7 días', dondeCambia: 'Fijo en el sistema' },
  ]
}
