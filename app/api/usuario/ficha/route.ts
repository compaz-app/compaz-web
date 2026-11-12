// PUT /api/usuario/ficha — el cliente completa la ficha de su familiar y acepta los términos.
// GET devuelve el texto vigente de los términos (con los números de Ajustes).
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { validarFicha, guardarFicha } from '@/lib/ficha'
import { textoTerminos } from '@/lib/terminos'
import { ok, err, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  return ok(await textoTerminos())
}

export async function PUT(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const v = validarFicha(await req.json().catch(() => null))
  if (!v.ok) return err(v.error)
  const r = await guardarFicha(user.id, v.datos)
  if (!r.ok) return err(r.error, 500)
  return ok(null)
}
