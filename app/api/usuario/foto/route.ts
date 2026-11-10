// /api/usuario/foto — la foto opcional del cliente (la ve el compita solo al decidir una solicitud).
// GET: ¿tengo foto? · POST (multipart, campo "foto"): subir o reemplazar · DELETE: quitarla.
// Se guarda en el almacenamiento privado con borrado automático (foto_retencion_dias). Una sola foto por persona.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { guardarFotoPrivada, fotoClienteVigente, borrarFotoPrivada } from '@/lib/fotos-privadas'
import { ok, err, unauthorized } from '@/lib/api'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 6 * 1024 * 1024

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  return ok({ tiene: !!(await fotoClienteVigente(user.id)) })
}

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const form = await req.formData().catch(() => null)
  const archivo = form?.get('foto')
  if (!(archivo instanceof Blob)) return err('Falta la foto')
  if (!TIPOS.includes(archivo.type)) return err('La foto debe ser JPG, PNG o WebP')
  if (archivo.size === 0 || archivo.size > MAX_BYTES) return err('La foto es demasiado grande (máximo 6 MB)')

  const anterior = await fotoClienteVigente(user.id)
  const guardada = await guardarFotoPrivada({ tipo: 'cliente', bytes: await archivo.arrayBuffer(), contentType: archivo.type, usuarioId: user.id })
  if (!guardada) return err('No pudimos guardar tu foto. Intenta de nuevo.', 500)
  // Reemplazo: la foto anterior se borra de verdad, no se acumulan copias.
  if (anterior) await borrarFotoPrivada(anterior.id)
  return ok({ tiene: true })
}

export async function DELETE() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const f = await fotoClienteVigente(user.id)
  if (f && !(await borrarFotoPrivada(f.id))) return err('No pudimos quitar tu foto. Intenta de nuevo.', 500)
  return ok({ tiene: false })
}
