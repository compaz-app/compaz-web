import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { tipoImagenReal, EXT } from '@/lib/imagen'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const foto = formData.get('foto') as File | null
  const nombre = (formData.get('nombre') as string) ?? 'compita'
  const token = (formData.get('token') as string) ?? ''

  if (!foto) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  // Validar token de onboarding antes de permitir la subida
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createAdminSupabase()
  const { data: tkn } = await admin
    .from('onboarding_tokens')
    .select('id, expires_at, usado')
    .eq('token', token)
    .single()
  if (!tkn || tkn.usado || new Date(tkn.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Validar tipo de archivo (allowlist estricta — bloquea SVG, HTML, etc.)
  if (!ALLOWED_TYPES.includes(foto.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo JPG, PNG o WEBP.' }, { status: 400 })
  }

  // Validar tamaño
  if (foto.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'La foto no puede superar 5 MB' }, { status: 400 })
  }

  // Verificar el contenido real (magic bytes) y forzar extensión desde el tipo detectado
  const buffer = Buffer.from(await foto.arrayBuffer())
  const tipo = tipoImagenReal(buffer)
  if (!tipo) return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
  const ext = EXT[tipo]
  const slug = nombre.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const path = `compitas/${slug}-${Date.now()}.${ext}`

  const { error } = await admin.storage
    .from('fotos')
    .upload(path, buffer, { contentType: tipo, upsert: false })

  if (error) {
    console.error('[onboarding/upload-foto]', error.message)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('fotos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
