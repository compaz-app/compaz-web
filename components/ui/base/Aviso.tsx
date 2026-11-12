// Aviso en línea: informa, confirma, advierte o alerta. Lleva el rol correcto para lectores de pantalla.
const TONOS = {
  info: { clase: 'bg-fondo-lavanda text-morado-claro border-borde-lavanda', rol: 'note' },
  exito: { clase: 'bg-verde-claro text-verde-oscuro border-verde-vivo', rol: 'status' },
  advertencia: { clase: 'bg-amarillo-claro text-ambar-oscuro border-amarillo-marca', rol: 'note' },
  peligro: { clase: 'bg-rojo-claro text-rojo-oscuro border-rojo', rol: 'alert' },
} as const

// `compacto` es el de las pantallas densas del panel del equipo: menos relleno y texto más chico. Por defecto, el grande de la familia.
const TAMANOS = { normal: 'rounded-2xl p-4 text-base font-bold', compacto: 'rounded-xl px-3 py-2 text-sm font-semibold' } as const

export default function Aviso({ tono = 'info', tamano = 'normal', children }: { tono?: keyof typeof TONOS; tamano?: keyof typeof TAMANOS; children: React.ReactNode }) {
  const t = TONOS[tono]
  return <div role={t.rol} className={`border leading-snug ${TAMANOS[tamano]} ${t.clase}`}>{children}</div>
}
