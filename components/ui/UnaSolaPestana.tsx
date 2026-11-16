'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import { CANAL_PESTANA, ESPERA_RESPUESTA_MS, debeResponder, type MensajePestana } from '@/lib/una-pestana'

type Estado = 'vigente' | 'duplicada' | 'cedida'

/**
 * Evita tener dos pestañas del portal abiertas. Si el cliente llega desde el botón de un correo y ya tenía el portal abierto:
 *  1. la pestaña que ya estaba se actualiza sola, así ve lo nuevo sin hacer nada;
 *  2. la pestaña nueva se queda quieta con un aviso («ya lo tienes abierto en otra pestaña»), intenta cerrarse sola y ofrece usar esta.
 * Si el cliente elige usar la nueva, la vieja queda en pausa con el mismo aviso. Sin BroadcastChannel (navegadores muy viejos) no hace nada.
 */
export default function UnaSolaPestana() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('vigente')
  const canal = useRef<BroadcastChannel | null>(null)
  const yo = useRef({ id: '', vigente: false, esperando: true })

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const id = (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 12)
    yo.current = { id, vigente: false, esperando: true }
    const c = new BroadcastChannel(CANAL_PESTANA)
    canal.current = c
    const mandar = (t: MensajePestana['t']) => c.postMessage({ t, id } satisfies MensajePestana)

    c.onmessage = (e: MessageEvent<MensajePestana>) => {
      const m = e.data
      if (!m || m.id === id) return
      if (m.t === 'hola' && debeResponder(yo.current, m)) {
        mandar('ocupada')
        if (yo.current.vigente) router.refresh() // alguien abrió el portal: esta pestaña se pone al día
      } else if (m.t === 'ocupada' && yo.current.esperando) {
        yo.current = { ...yo.current, esperando: false, vigente: false }
        setEstado('duplicada')
        window.close() // solo funciona si el navegador lo permite; si no, queda el aviso
      } else if (m.t === 'tomar' && yo.current.vigente) {
        yo.current = { ...yo.current, vigente: false }
        setEstado('cedida')
      }
    }
    mandar('hola')
    const t = setTimeout(() => {
      if (yo.current.esperando) { yo.current = { ...yo.current, esperando: false, vigente: true } }
    }, ESPERA_RESPUESTA_MS)
    return () => { clearTimeout(t); c.close(); canal.current = null }
  }, [router])

  function usarEsta() {
    yo.current = { ...yo.current, vigente: true, esperando: false }
    canal.current?.postMessage({ t: 'tomar', id: yo.current.id } satisfies MensajePestana)
    setEstado('vigente'); router.refresh()
  }

  if (estado === 'vigente') return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="una-pestana" className="fixed inset-0 z-50 grid place-items-center bg-fondo-claro px-4">
      <Tarjeta>
        <h2 id="una-pestana" className="text-xl font-extrabold text-morado-profundo">{estado === 'duplicada' ? 'Ya tienes Compaz abierto en otra pestaña' : 'Seguiste en otra pestaña'}</h2>
        <p className="mt-2 text-lg text-morado-claro">{estado === 'duplicada' ? 'Esa pestaña ya se puso al día con lo nuevo. Puedes cerrar esta y volver a la otra.' : 'Esta pestaña quedó en pausa para no duplicar tu portal. Puedes cerrarla o usarla de nuevo.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton onClick={usarEsta} info="Usa esta pestaña para ver tu portal. La otra pestaña quedará en pausa para no tenerlo duplicado.">Usar esta pestaña</Boton>
          <Boton variante="secundario" onClick={() => window.close()} info="Intenta cerrar esta pestaña. Si tu navegador no lo permite, ciérrala tú con la X de la pestaña.">Cerrar esta pestaña</Boton>
        </div>
      </Tarjeta>
    </div>
  )
}
