import type { DailyRoom } from '@/types'
import { minutosCorteLlamada, minutosLlamadaVisita } from '@/lib/llamada'

const DAILY_API = 'https://api.daily.co/v1'

export async function getOrCreateDailyRoom(visitId: string, existingRoom?: string | null, soloAudio = false): Promise<DailyRoom> {
  // Cada llamada dura lo que dice Ajustes (llamada_visita_min) y la sala se cierra sola al cumplirse. Si la sala existente sigue abierta se
  // reutiliza (la otra parte entra a la misma llamada); si ya se cerró, se crea una nueva. Nunca se alarga una sala.
  const minutos = await minutosLlamadaVisita()
  if (existingRoom) {
    const nombreSala = existingRoom.split('?')[0].replace(/\/+$/, '').split('/').pop() ?? existingRoom
    const res = await fetch(`${DAILY_API}/rooms/${nombreSala}`, {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    })
    if (res.ok) {
      const room = await res.json() as DailyRoom & { config?: { exp?: number } }
      if (room.config?.exp && room.config.exp - Math.floor(Date.now() / 1000) > 15) return room
    }
  }

  // Crear sala nueva
  const name = `cmp-${visitId.slice(0, 8)}-${Date.now()}`
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_chat: false,
        enable_screenshare: false,
        exp: Math.floor(Date.now() / 1000) + minutos * 60,
        eject_at_room_exp: true,
        max_participants: 3,
        lang: 'es',
        start_video_off: soloAudio,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Daily.co createRoom error: ${err}`)
  }

  return res.json() as Promise<DailyRoom>
}

export async function createDailyRoom(visitId: string): Promise<DailyRoom> {
  return getOrCreateDailyRoom(visitId)
}

/**
 * Sala de entrevista de presentación: 3 participantes, expira a los N min del slot (Ajustes: llamada_corte_min, 23 de fábrica) confirmado.
 * Sin `nbf` de Daily: la sala existe desde que se crea y la ventana de entrada (10 min antes del slot)
 * la controla la página /sala, para que un desfase de reloj o de zona nunca deje la sala "no disponible".
 */
export async function createEntrevistaRoom(solicitudId: string, slotConfirmado: Date): Promise<DailyRoom> {
  const name = `ent-${solicitudId.slice(0, 8)}-${Date.now()}`
  const corte = await minutosCorteLlamada()
  const exp = Math.floor(slotConfirmado.getTime() / 1000) + corte * 60

  const res = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_chat: false,
        enable_screenshare: false,
        exp,
        max_participants: 3, // cliente + compita + admin supervisor
        lang: 'es',
        start_video_off: false,
        eject_at_room_exp: true, // expulsa automáticamente al llegar al corte
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Daily.co createEntrevistaRoom error: ${errText}`)
  }

  return res.json() as Promise<DailyRoom>
}

export async function deleteDailyRoom(roomName: string): Promise<void> {
  const res = await fetch(`${DAILY_API}/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
  })
  if (!res.ok) {
    console.error(`Daily.co deleteRoom error for ${roomName}:`, await res.text())
  }
}
