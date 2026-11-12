import { NextRequest } from 'next/server'
import { ok, err, serverError } from '@/lib/api'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { tipoImagenReal, EXT } from '@/lib/imagen'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const formData = await req.formData()
  const foto = formData.get('foto') as File | null
  const nombre = (formData.get('nombre') as string) ?? 'compita'

  if (!foto) return err('Sin archivo')
  if (!ALLOWED_TYPES.includes(foto.type)) return err('Solo JPG, PNG o WEBP.')
  if (foto.size > MAX_SIZE_BYTES) return err('La foto no puede superar 5 MB')

  const buffer = Buffer.from(await foto.arrayBuffer())
  const tipo = tipoImagenReal(buffer)
  if (!tipo) return err('El archivo no es una imagen válida')
  const ext = EXT[tipo]
  const slug = nombre.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const path = `compitas/${slug}-${Date.now()}.${ext}`

  const admin = createAdminSupabase()
  const { error } = await admin.storage.from('fotos').upload(path, buffer, { contentType: tipo, upsert: false })
  if (error) return serverError(error)

  const { data: { publicUrl } } = admin.storage.from('fotos').getPublicUrl(path)
  return ok({ url: publicUrl })
}
