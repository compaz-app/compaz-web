// Aviso en línea: informa, confirma, advierte o alerta. Lleva el rol correcto para lectores de pantalla.
const TONOS = {
  info: { clase: 'bg-fondo-lavanda text-morado-claro border-borde-lavanda', rol: 'note' },
  exito: { clase: 'bg-verde-claro text-verde-oscuro border-verde-vivo', rol: 'status' },
  advertencia: { clase: 'bg-amarillo-claro text-ambar-oscuro border-amarillo-marca', rol: 'note' },
  peligro: { clase: 'bg-rojo-claro text-rojo-oscuro border-rojo', rol: 'alert' },
} as const

export default function Aviso({ tono = 'info', children }: { tono?: keyof typeof TONOS; children: React.ReactNode }) {
  const t = TONOS[tono]
  return <div role={t.rol} className={`rounded-2xl border p-4 text-base font-bold leading-snug ${t.clase}`}>{children}</div>
}
