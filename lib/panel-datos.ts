// Recorte de datos del panel según los permisos de quien mira. Se aplica en el SERVIDOR, antes de que
// los datos viajen al navegador: lo que no se manda no se puede ver con "inspeccionar".
// Contactos y datos sensibles (correo, teléfono, Telegram, código de acceso) solo con el permiso 'telefonos'.
// Enlaces de sala (room_url) solo con 'atender'. El administrador raíz lo ve todo.

import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { detectarContacto } from '@/lib/detectar-contacto'

const OCULTO = 'oculto'

export function recortarParaActor<T>(actor: Actor, datos: T): T {
  const verContactos = puede(actor, 'telefonos')
  const verSalas = puede(actor, 'atender')
  if (verContactos && verSalas) return datos

  const recorrer = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(recorrer)
    if (v && typeof v === 'object') {
      const salida: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (!verContactos && (k === 'email' || k === 'telefono' || k === 'telegram_chat_id' || k === 'codigo')) {
          // Se conserva "tiene / no tiene" porque la pantalla lo usa para estados, sin revelar el valor.
          if (val === null || val === undefined || val === '') salida[k] = val
          else salida[k] = k === 'email' ? '' : k === 'telegram_chat_id' ? OCULTO : null
        } else if (!verSalas && k === 'room_url') {
          salida[k] = null
        } else {
          salida[k] = recorrer(val)
        }
      }
      return salida
    }
    return v
  }
  return recorrer(datos) as T
}

/** Un texto libre del sistema (nota de una tarea, resumen de actividad): sin 'telefonos' se le tapan teléfonos y correos. */
export function recortarTexto(actor: Actor, texto: string): string {
  return puede(actor, 'telefonos') ? texto : detectarContacto(texto).textoCensurado
}
