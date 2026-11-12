// Ficha obligatoria del familiar con consentimiento. La validación vive en el SERVIDOR: la pantalla solo ayuda.
// Los datos del cliente (teléfono) nunca van al compita; ver reglas de contacto en docs/construccion-real.md.
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento } from '@/lib/eventos'
import { TERMINOS_VERSION } from '@/lib/terminos'

import { PARENTESCOS } from '@/lib/ficha-opciones'
export { PARENTESCOS }

export interface DatosFicha {
  telefono: string
  pais: string
  parentesco: (typeof PARENTESCOS)[number]
  familiar_nombre: string
  familiar_edad: number | null
  familiar_condicion: string | null
  familiar_notas: string | null
  zona: string | null
  lugar_privado: boolean
  ficha_sin_nadie: boolean | null
  ficha_personas: string | null
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function validarFicha(b: unknown): { ok: true; datos: DatosFicha } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Solicitud inválida' }
  const x = b as Record<string, unknown>

  const telefono = texto(x.telefono)
  if (!/^[+\d][\d\s().-]{6,24}$/.test(telefono) || telefono.replace(/\D/g, '').length < 7) return { ok: false, error: 'Escribe tu teléfono con el código de país' }
  const pais = texto(x.pais)
  if (!pais || pais.length > 60) return { ok: false, error: 'Dinos en qué país vives' }
  const parentesco = texto(x.parentesco) as DatosFicha['parentesco']
  if (!PARENTESCOS.includes(parentesco)) return { ok: false, error: 'Elige qué eres de tu familiar' }
  const familiar_nombre = texto(x.familiar_nombre)
  if (!familiar_nombre || familiar_nombre.length > 120) return { ok: false, error: 'El nombre de tu familiar es obligatorio' }

  let familiar_edad: number | null = null
  if (x.familiar_edad !== undefined && x.familiar_edad !== null && x.familiar_edad !== '') {
    const n = Number(x.familiar_edad)
    if (!Number.isInteger(n) || n < 1 || n > 120) return { ok: false, error: 'La edad debe estar entre 1 y 120' }
    familiar_edad = n
  }
  const condicion = texto(x.familiar_condicion)
  if (condicion.length > 200) return { ok: false, error: 'La condición es demasiado larga (máximo 200 letras)' }
  const notas = texto(x.familiar_notas)
  if (notas.length > 800) return { ok: false, error: 'Las notas son demasiado largas (máximo 800 letras)' }
  const zona = texto(x.zona)

  if (typeof x.lugar_privado !== 'boolean') return { ok: false, error: 'Dinos si estará en una casa u otro lugar privado' }
  const lugar_privado = x.lugar_privado
  let ficha_sin_nadie: boolean | null = null
  let ficha_personas: string | null = null
  if (lugar_privado) {
    if (x.ficha_sin_nadie === true) ficha_sin_nadie = true
    else {
      const p = texto(x.ficha_personas)
      if (!p) return { ok: false, error: 'Escribe quién más estará en el lugar, o marca que no habrá nadie más' }
      if (p.length > 300) return { ok: false, error: 'La lista de personas es demasiado larga (máximo 300 letras)' }
      ficha_sin_nadie = false
      ficha_personas = p
    }
  }

  if (x.acepto !== true) return { ok: false, error: 'Para continuar tienes que aceptar los términos' }

  return {
    ok: true,
    datos: {
      telefono, pais, parentesco, familiar_nombre, familiar_edad,
      familiar_condicion: condicion || null, familiar_notas: notas || null, zona: zona || null,
      lugar_privado, ficha_sin_nadie, ficha_personas,
    },
  }
}

export async function guardarFicha(usuarioId: string, d: DatosFicha): Promise<{ ok: true } | { ok: false; error: string }> {
  const ahora = new Date().toISOString()
  const { error } = await createAdminSupabase().from('usuarios').update({
    telefono: d.telefono, pais: d.pais, parentesco: d.parentesco,
    familiar_nombre: d.familiar_nombre, familiar_edad: d.familiar_edad, familiar_condicion: d.familiar_condicion, familiar_notas: d.familiar_notas,
    ...(d.zona ? { zona: d.zona } : {}),
    lugar_privado: d.lugar_privado, ficha_sin_nadie: d.ficha_sin_nadie, ficha_personas: d.ficha_personas,
    terminos_version: TERMINOS_VERSION, terminos_aceptados_en: ahora,
  }).eq('id', usuarioId)
  if (error) { console.error('[guardarFicha]', error.message); return { ok: false, error: 'No pudimos guardar tu ficha. Inténtalo de nuevo.' } }
  await registrarEvento({ entidad: 'cliente', entidadId: usuarioId, tipo: 'terminos_aceptados', actor: `cliente:${usuarioId}`, datos: { version: TERMINOS_VERSION } })
  return { ok: true }
}

/** La ficha está completa cuando hay familiar, teléfono y se aceptaron los términos. */
export function fichaCompleta(u: { familiar_nombre?: string | null; telefono?: string | null; terminos_aceptados_en?: string | null } | null | undefined): boolean {
  return !!(u?.familiar_nombre && u.telefono && u.terminos_aceptados_en)
}
