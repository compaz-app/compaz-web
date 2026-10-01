'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

interface Props {
  usuarioId: string
  visitaActivaId: string | null
}

export default function VisitaWatcher({ usuarioId, visitaActivaId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const canal = supabase
      .channel(`visita-status-${usuarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitas', filter: `usuario_id=eq.${usuarioId}` },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [usuarioId, visitaActivaId, router])

  return null
}
