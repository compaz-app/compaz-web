// Detección y censura de datos de contacto en un texto. PURO (sin base de datos ni Telegram): lo usan el servidor
// (chat, solicitudes) y la pantalla del cliente para avisarle antes de enviar. Una sola lista de patrones.

const PATRONES: { regex: RegExp; censurar: (m: string) => string }[] = [
  // Teléfonos venezolanos: 0412 0414 0416 0422 0424 0426 + 7 dígitos (con espacios/guiones)
  // Se censura el número COMPLETO (antes solo se tapaban los últimos 4 dígitos y el resto seguía legible).
  {
    regex: /\b(04(?:1[246]|2[246])\s?[-.]?\s?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d)\b/g,
    censurar: () => '[teléfono eliminado]',
  },
  // Formato internacional +58...
  {
    regex: /\+58\s?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d/g,
    censurar: () => '[teléfono eliminado]',
  },
  // Cualquier teléfono de otro país (EE.UU., España, Colombia...): una racha de 9 a 15 dígitos, con o sin
  // "+", espacios, guiones, puntos o paréntesis. Los clientes viven en el exterior, así que esto es lo más probable.
  {
    regex: /(?<!\d)\(?\+?\d(?:[\s().-]{0,2}\d){8,14}(?!\d)/g,
    censurar: () => '[teléfono eliminado]',
  },
  // Correos electrónicos
  {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    censurar: () => '[correo eliminado]',
  },
  // Correos escritos con palabras para esquivar el filtro: "nombre arroba gmail punto com"
  {
    regex: /\b[\w.-]+\s*(?:arroba|\(at\)|\[at\])\s*[\w.-]+\s*(?:punto|\(dot\)|\[dot\])\s*[a-z]{2,}\b/gi,
    censurar: () => '[correo eliminado]',
  },
  // Menciones explícitas de canales externos
  {
    regex: /\b(whatsapp|instagram|telegram|mi\s+ig|mi\s+insta|escr[ií]beme\s+al|cont[aá]ctame\s+por|agrégame|add\s+me)\b/gi,
    censurar: (m) => m, // no se censura el texto, solo se detecta
  },
]

export function detectarContacto(texto: string): { detectado: boolean; textoCensurado: string } {
  let detectado = false
  let censurado = texto

  for (const { regex, censurar } of PATRONES) {
    regex.lastIndex = 0
    if (regex.test(texto)) {
      detectado = true
      regex.lastIndex = 0
      censurado = censurado.replace(regex, censurar)
    }
  }

  return { detectado, textoCensurado: censurado }
}
