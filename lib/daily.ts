import type { DailyRoom } from '@/types'

const DAILY_API = 'https://api.daily.co/v1'

export async function getOrCreateDailyRoom(visitId: string, existingRoom?: string | null, soloAudio = false): Promise<DailyRoom> {
  // Intentar reutilizar sala existente
  if (existingRoom) {
    const res = await fetch(`${DAILY_API}/rooms/${existingRoom}`, {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    })
    if (res.ok) {
      const room = await res.json() as DailyRoom
      // Extender expiración si está próxima a vencer
      const now = Math.floor(Date.now() / 1000)
      if (!room.config?.exp || room.config.exp - now < 600) {
        await fetch(`${DAILY_API}/rooms/${existingRoom}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
          body: JSON.stringify({ properties: { exp: now + 60 * 60 * 4 } }),
        })
      }
      return room
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
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
        max_participants: 3,
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

export async function deleteDailyRoom(roomName: string): Promise<void> {
  const res = await fetch(`${DAILY_API}/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
  })
  if (!res.ok) {
    console.error(`Daily.co deleteRoom error for ${roomName}:`, await res.text())
  }
}
