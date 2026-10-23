// POST /api/admin/postulaciones/resolver — resolver una postulación de la bandeja
// Body: { id, resolucion: 'vinculada_airtable' | 'registrada_en_cmc' | 'no_procede', nota?, airtableId? }
// El operador queda registrado con el correo verificado de su sesión.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { resolverPostulacion, type Resolucion } from '@/lib/captacion'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin?.email) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; resolucion?: unknown; nota?: unknown; airtableId?: unknown }
  const r = await resolverPostulacion(
    typeof body.id === 'string' ? body.id : '',
    body.resolucion as Resolucion,
    admin.email.toLowerCase(),
    typeof body.nota === 'string' ? body.nota : '',
    typeof body.airtableId === 'string' ? body.airtableId.trim() : '',
  )
  return r.ok ? ok(null) : err(r.error)
}
