'use client'
import InfoBoton from './InfoBoton'

// Un botón con su ⓘ al lado: explica qué hace y qué provoca.
export default function ConInfo({ que, texto, children }: { que: string; texto: string; children: React.ReactNode }) {
  return <div className="flex items-center gap-1"><div className="min-w-0 flex-1 [&>*]:w-full">{children}</div><InfoBoton que={que} texto={texto} alineado="izquierda" /></div>
}
