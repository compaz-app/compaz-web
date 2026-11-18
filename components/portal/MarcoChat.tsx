'use client'

import { useRef } from 'react'

/**
 * El marco del chat del portal. Al tocar la caja de texto el teléfono abre el teclado y mueve la página por su cuenta, y el chat quedaba a la mitad de la
 * pantalla. Aquí, cuando se enfoca algo dentro del chat, el marco se pega arriba de la zona visible (dos veces: una cuando empieza a subir el teclado y otra
 * cuando ya subió) y, con el teclado abierto, ocupa justo el alto visible (`--alto-visible`, ver AjusteMovil).
 */
// En el teléfono el chat gasta menos marco: cabecera y caja de escribir más delgadas y menos relleno en los mensajes; con el teclado abierto la cabecera se esconde
// (ahí cada píxel es para los mensajes). En escritorio queda como estaba. Los `!` pisan los estilos en línea del componente Chat, que se comparte con la pantalla vieja.
const COMPACTO = [
  'max-lg:[&_[data-chat-cabecera]]:!px-4 max-lg:[&_[data-chat-cabecera]]:!py-2.5',
  'max-lg:[&_[data-chat-mensajes]]:!p-3',
  'max-lg:[&_[data-chat-form]]:!p-2.5 max-lg:[&_[data-chat-campo]]:!py-2.5',
  '[[data-teclado=abierto]_&_[data-chat-cabecera]]:!hidden',
].join(' ')

export default function MarcoChat({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  const marco = useRef<HTMLElement>(null)
  const alEnfocar = () => {
    for (const ms of [120, 450]) setTimeout(() => marco.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), ms)
  }
  return (
    <section ref={marco} onFocusCapture={alEnfocar} aria-label={`Chat con ${nombre}`}
      className={`flex h-[min(34rem,75dvh)] scroll-mt-2 flex-col overflow-hidden rounded-2xl border-2 border-morado-medio bg-fondo-claro shadow-sm [[data-teclado=abierto]_&]:h-[calc(var(--alto-visible)-1rem)] ${COMPACTO}`}>
      {children}
    </section>
  )
}
