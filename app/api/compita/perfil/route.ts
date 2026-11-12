// GET  /api/compita/perfil?token=XXX  — carga el perfil actual para pre-llenar el formulario
// PUT  /api/compita/perfil             — guarda los cambios (token en el body)
import { NextRequest } from 'next/server'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'
import { validarTokenPerfil, consumirTokenPerfil, restaurarTokenPerfil } from '@/lib/compita-tokens'
import { validarPerfil } from '@/lib/validar'
import { getCompitaAdminById, actualizarCompita } from '@/lib/compitas'
import { sendTelegramMessage } from '@/lib/telegram'
import { createAdminSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return unauthorized()

  const compitaId = await validarTokenPerfil(token)
  if (!compitaId) return err('Token inválido o expirado', 401)

  const compita = await getCompitaAdminById(compitaId)
  if (!compita) return notFound('Compita')

  return ok({
    nombre: compita.nombre,
    zona: compita.zona,
    descripcion: compita.descripcion,
    servicios: compita.servicios ?? [],
    youtube_url: compita.youtube_url,
    foto_url: compita.foto_url,
    horarios_disponibles: compita.horarios_disponibles ?? [],
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as (Record<string, unknown> & { token?: string }) | null
  if (!body || typeof body.token !== 'string' || !body.token) return unauthorized()
  const token = body.token

  // Validar ANTES de consumir el token: un error de formato no debe quemar el enlace.
  // El nombre solo lo cambia el admin; verificado/estado/rating nunca se aceptan aquí.
  const v = validarPerfil(body, { permitirNombre: false })
  if (!v.ok) return err(v.error)

  const compitaId = await consumirTokenPerfil(token)
  if (!compitaId) return err('Token inválido, expirado o ya usado', 401)

  try {
    await actualizarCompita(compitaId, v.datos)
  } catch (e) {
    await restaurarTokenPerfil(token) // el guardado falló: la compita conserva su enlace
    console.error('[compita/perfil] error guardando:', e)
    return serverError(e)
  }

  // Confirmar por Telegram si la compita está vinculada
  const admin = createAdminSupabase()
  const { data: compita } = await admin.from('compitas').select('telegram_chat_id').eq('id', compitaId).single()
  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        `✅ <b>¡Tu perfil fue actualizado!</b>\n\nLos cambios ya son visibles para las familias en la plataforma.\n\nEscribe /perfil cuando quieras editarlo de nuevo.`,
      )
    } catch (e) { console.error('Telegram confirmación perfil:', e) }
  }

  return ok({ guardado: true })
}
