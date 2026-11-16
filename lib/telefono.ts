// Teléfonos con país y validación, para que un error de tipeo no deje un número que no existe. Función PURA (sin base de datos): la usan el servidor y la
// pantalla. Todo se guarda en formato internacional sin espacios (E.164, por ejemplo +584145550101) y se muestra con espacios (+58 414 555 0101).
//
// Cada país define cuántos dígitos lleva su número y cómo empieza. Venezuela es la más estricta (el contacto en el sitio vive allá): celulares 412, 414, 416,
// 422, 424 o 426 y fijos que empiezan con 2, y se quita el 0 de marcación local (0414 pasa a 414). Un país que no está en la lista se acepta solo si el
// número completo, con su +, tiene entre 8 y 15 dígitos (el máximo del estándar).

export interface PaisTel {
  id: string
  nombre: string
  /** Solo dígitos, sin el +. */
  prefijo: string
  /** Ejemplo del número nacional, como se muestra en la pantalla. */
  ejemplo: string
  /** El número nacional (sin prefijo ni 0 de marcación) tiene esta forma. */
  valido: (nacional: string) => boolean
  /** Se marca un 0 delante dentro del país (0414...) que no forma parte del número internacional. */
  troncal: boolean
  /** Cómo se agrupan los dígitos al mostrarlo. */
  grupos: number[]
}

export const PAISES_TEL: PaisTel[] = [
  { id: 've', nombre: 'Venezuela', prefijo: '58', ejemplo: '414 555 0101', valido: (n) => /^(4(12|14|16|22|24|26)\d{7}|2\d{9})$/.test(n), troncal: true, grupos: [3, 3, 4] },
  { id: 'us', nombre: 'EE. UU., Canadá y Caribe (+1)', prefijo: '1', ejemplo: '305 555 0123', valido: (n) => /^[2-9]\d{2}[2-9]\d{6}$/.test(n), troncal: false, grupos: [3, 3, 4] },
  { id: 'co', nombre: 'Colombia', prefijo: '57', ejemplo: '310 123 4567', valido: (n) => /^(3\d{9}|60\d{8})$/.test(n), troncal: false, grupos: [3, 3, 4] },
  { id: 'es', nombre: 'España', prefijo: '34', ejemplo: '612 345 678', valido: (n) => /^[6-9]\d{8}$/.test(n), troncal: false, grupos: [3, 3, 3] },
  { id: 'mx', nombre: 'México', prefijo: '52', ejemplo: '55 1234 5678', valido: (n) => /^[1-9]\d{9}$/.test(n), troncal: false, grupos: [2, 4, 4] },
  { id: 'pa', nombre: 'Panamá', prefijo: '507', ejemplo: '6123 4567', valido: (n) => /^[2-9]\d{6,7}$/.test(n), troncal: false, grupos: [4, 4] },
  { id: 'cl', nombre: 'Chile', prefijo: '56', ejemplo: '9 1234 5678', valido: (n) => /^[2-9]\d{8}$/.test(n), troncal: false, grupos: [1, 4, 4] },
  { id: 'ar', nombre: 'Argentina', prefijo: '54', ejemplo: '11 1234 5678', valido: (n) => /^[1-9]\d{9}$/.test(n), troncal: false, grupos: [2, 4, 4] },
  { id: 'pe', nombre: 'Perú', prefijo: '51', ejemplo: '912 345 678', valido: (n) => /^(9\d{8}|[1-8]\d{7})$/.test(n), troncal: false, grupos: [3, 3, 3] },
  { id: 'ec', nombre: 'Ecuador', prefijo: '593', ejemplo: '99 123 4567', valido: (n) => /^(9\d{8}|[2-7]\d{7})$/.test(n), troncal: true, grupos: [2, 3, 4] },
  { id: 'br', nombre: 'Brasil', prefijo: '55', ejemplo: '11 91234 5678', valido: (n) => /^[1-9]{2}(9\d{8}|[2-5]\d{7})$/.test(n), troncal: true, grupos: [2, 5, 4] },
  { id: 'cr', nombre: 'Costa Rica', prefijo: '506', ejemplo: '8312 3456', valido: (n) => /^[2-8]\d{7}$/.test(n), troncal: false, grupos: [4, 4] },
  { id: 'pt', nombre: 'Portugal', prefijo: '351', ejemplo: '912 345 678', valido: (n) => /^[1-9]\d{8}$/.test(n), troncal: false, grupos: [3, 3, 3] },
  { id: 'it', nombre: 'Italia', prefijo: '39', ejemplo: '312 345 6789', valido: (n) => /^(3\d{8,9}|0\d{5,10})$/.test(n), troncal: false, grupos: [3, 3, 4] },
  { id: 'gb', nombre: 'Reino Unido', prefijo: '44', ejemplo: '7123 456789', valido: (n) => /^[1-9]\d{9}$/.test(n), troncal: true, grupos: [4, 6] },
]

export const PAIS_OTRO = 'otro'
/** El país por defecto del contacto en el sitio: ahí viven las personas que se cuidan. */
export const PAIS_POR_DEFECTO = 've'

export const paisPorId = (id: string): PaisTel | undefined => PAISES_TEL.find((p) => p.id === id)

// Los prefijos de más dígitos se prueban primero (+507 antes que +5, +593 antes que +59...).
const POR_PREFIJO = [...PAISES_TEL].sort((a, b) => b.prefijo.length - a.prefijo.length)

const soloDigitos = (t: string) => t.replace(/\D/g, '')

export type ResultadoTel = { ok: true; e164: string; pais: PaisTel | null; nacional: string; formateado: string } | { ok: false; error: string }

const ERR_VACIO = 'Escribe el teléfono de contacto.'
const errPais = (p: PaisTel) => `Ese número no parece de ${p.nombre}. Revisa los dígitos. Ejemplo: ${p.ejemplo}`

/** Agrupa los dígitos nacionales según el país: 4145550101 → 414 555 0101. */
export function agrupar(nacional: string, grupos: number[]): string {
  const partes: string[] = []; let i = 0
  for (const g of grupos) { if (i >= nacional.length) break; partes.push(nacional.slice(i, i + g)); i += g }
  if (i < nacional.length) partes.push(nacional.slice(i))
  return partes.join(' ')
}

const armar = (pais: PaisTel, nacional: string): ResultadoTel => ({ ok: true, e164: `+${pais.prefijo}${nacional}`, pais, nacional, formateado: `+${pais.prefijo} ${agrupar(nacional, pais.grupos)}` })

/**
 * El número que escribió la persona dentro de un país elegido. Acepta que escriba el 0 de marcación local (0414 5550101), que pegue el prefijo del país
 * (+58 414 555 0101) y separadores de cualquier tipo. Si no calza con las reglas de ese país, dice cómo debería verse.
 */
export function validarNacional(pais: PaisTel, texto: string): ResultadoTel {
  let d = soloDigitos(texto)
  if (!d) return { ok: false, error: ERR_VACIO }
  // Pegó el número completo con el prefijo del país: se quita (solo si lo que queda calza, para no confundir un 58... que sea parte del número).
  if (d.startsWith(pais.prefijo) && pais.valido(quitarTroncal(pais, d.slice(pais.prefijo.length)))) d = d.slice(pais.prefijo.length)
  const nacional = quitarTroncal(pais, d)
  return pais.valido(nacional) ? armar(pais, nacional) : { ok: false, error: errPais(pais) }
}

function quitarTroncal(pais: PaisTel, d: string): string {
  return pais.troncal ? d.replace(/^0+/, '') : d
}

/**
 * Un teléfono escrito en cualquier forma, para el servidor. Con «+» (o «00») se detecta el país por el prefijo y se valida como número de ese país; si el país no
 * está en la lista, basta con que tenga entre 8 y 15 dígitos. Sin «+» solo se acepta un número venezolano escrito en local (0414 5550101), por compatibilidad;
 * cualquier otro tiene que traer su prefijo para no adivinar el país.
 */
export function validarTelefono(valor: unknown): ResultadoTel {
  if (typeof valor !== 'string' || !valor.trim()) return { ok: false, error: ERR_VACIO }
  const crudo = valor.trim()
  if (/[^\d\s().+\-]/.test(crudo)) return { ok: false, error: 'El teléfono solo puede llevar números, espacios y el signo +.' }
  const conMas = crudo.startsWith('+') || crudo.startsWith('00')
  const d = soloDigitos(crudo.startsWith('00') ? crudo.slice(2) : crudo)
  if (!d) return { ok: false, error: ERR_VACIO }
  if (!conMas) {
    const ve = paisPorId('ve')!
    const r = validarNacional(ve, d)
    if (r.ok) return r
    // Parece un número venezolano mal escrito (0414..., 0212...): se dice cómo debe verse. Cualquier otro necesita su +.
    return /^0?[24]/.test(d) ? { ok: false, error: errPais(ve) } : { ok: false, error: 'Escribe el teléfono con el código de país, por ejemplo +58 414 555 0101.' }
  }
  const pais = POR_PREFIJO.find((p) => d.startsWith(p.prefijo))
  if (pais) {
    const r = validarNacional(pais, d.slice(pais.prefijo.length))
    return r.ok ? r : { ok: false, error: errPais(pais) }
  }
  if (!/^[1-9]\d{7,14}$/.test(d)) return { ok: false, error: 'Ese teléfono no parece válido: con el código de país debe tener entre 8 y 15 dígitos.' }
  return { ok: true, e164: `+${d}`, pais: null, nacional: d, formateado: `+${d}` }
}

/** Para mostrar un teléfono guardado: con espacios si se reconoce el país; si no, tal cual. */
export function formatearTelefono(guardado: string | null | undefined): string {
  if (!guardado) return ''
  const r = validarTelefono(guardado)
  return r.ok ? r.formateado : guardado
}
