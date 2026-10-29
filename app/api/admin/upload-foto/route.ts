import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { tipoImagenReal, EXT } from '@/lib/imagen'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const foto = formData.get('foto') as File | null
  const nombre = (formData.get('nombre') as string) ?? 'compita'

  if (!foto) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(foto.type)) return NextResponse.json({ error: 'Solo JPG, PNG o WEBP.' }, { status: 400 })
  if (foto.size > MAX_SIZE_BYTES) return NextResponse.json({ error: 'La foto no puede superar 5 MB' }, { status: 400 })

  const buffer = Buffer.from(await foto.arrayBuffer())
  const tipo = tipoImagenReal(buffer)
  if (!tipo) return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
  const ext = EXT[tipo]
  const slug = nombre.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const path = `compitas/${slug}-${Date.now()}.${ext}`

  const admin = createAdminSupabase()
  const { error } = await admin.storage.from('fotos').upload(path, buffer, { contentType: tipo, upsert: false })
  if (error) return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('fotos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
