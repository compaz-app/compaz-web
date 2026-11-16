'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

const CADA_MS = 45_000

/**
 * El portal en vivo. Invisible. Hace tres cosas, solo mientras la pestaña está a la vista:
 *  1. Escucha las novedades del cliente (Realtime, con su propia sesión: solo ve las suyas). Al llegar una, la pantalla se actualiza al instante.
 *  2. Avisa cada 45 s que el portal está abierto (latido), para que el sistema sepa si hace falta el correo de respaldo.
 *  3. Marca lo nuevo como visto cuando el cliente lo está mirando: el correo de respaldo de eso ya no sale.
 * Si Realtime falla, el portal sigue actualizándose por consultas periódicas (AutoRefresh), así que esto solo mejora la rapidez.
 */
export default function NovedadesEnVivo({ usuarioId }: { usuarioId: string }) {
  const router = useRouter()

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible'
    const post = (ruta: string) => fetch(ruta, { method: 'POST' }).catch(() => undefined)
    const latidoYVisto = () => { if (!visible()) return; void post('/api/portal/latido'); void post('/api/portal/novedades/vistas') }

    latidoYVisto()
    const t = setInterval(() => { if (visible()) void post('/api/portal/latido') }, CADA_MS)
    const alVolver = () => { if (visible()) { latidoYVisto(); router.refresh() } }
    document.addEventListener('visibilitychange', alVolver)

    const supabase = createBrowserSupabase()
    let canal: ReturnType<typeof supabase.channel> | undefined
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      canal = supabase
        .channel(`novedades-${usuarioId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'novedades_cliente', filter: `usuario_id=eq.${usuarioId}` }, () => {
          router.refresh()
          if (visible()) void post('/api/portal/novedades/vistas')
        })
        .subscribe()
    })

    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); if (canal) supabase.removeChannel(canal) }
  }, [usuarioId, router])

  return null
}
