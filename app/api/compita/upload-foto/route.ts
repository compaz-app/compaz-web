// POST /api/compita/upload-foto
// Sube una foto de perfil para el compita, validando el token de edición.
// El token NO se consume aquí — se consume al guardar el perfil completo.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { tipoImagenReal, EXT } from '@/lib/imagen'
import { validarTokenPerfil } from '@/lib/compita-tokens'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const foto = formData.get('foto') as File | null
  const token = (formData.get('token') as string) ?? ''

  if (!foto) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const compitaId = await validarTokenPerfil(token)
  if (!compitaId) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })

  if (!ALLOWED_TYPES.includes(foto.type)) {
    return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
  }
  if (foto.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'La imagen no puede superar 5 MB' }, { status: 400 })
  }

  const supabase = createAdminSupabase()
  const buffer = Buffer.from(await foto.arrayBuffer())
  const tipo = tipoImagenReal(buffer)
  if (!tipo) return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
  const path = `compitas/${compitaId}/perfil-${Date.now()}.${EXT[tipo]}`

  const { error } = await supabase.storage.from('fotos').upload(path, buffer, {
    contentType: tipo,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
