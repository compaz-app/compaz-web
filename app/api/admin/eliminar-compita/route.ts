import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { eliminarCompita } from '@/lib/compitas'

export async function DELETE(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { compita_id, force } = (await req.json().catch(() => ({})))
  if (!compita_id) return err('compita_id requerido')

  try {
    await eliminarCompita(compita_id, force === true)
    return ok(null)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('TIENE_VISITAS:')) {
      const visitas = parseInt(msg.split(':')[1], 10)
      return NextResponse.json({ error: 'tiene_visitas', visitas }, { status: 409 })
    }
    return serverError(e)
  }
}
