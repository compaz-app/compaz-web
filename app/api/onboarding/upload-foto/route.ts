import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const foto = formData.get('foto') as File | null
  const nombre = (formData.get('nombre') as string) ?? 'compita'

  if (!foto) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const ext = foto.name.split('.').pop() ?? 'jpg'
  const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const path = `compitas/${slug}-${Date.now()}.${ext}`

  const admin = createAdminSupabase()
  const { error } = await admin.storage
    .from('fotos')
    .upload(path, foto, { contentType: foto.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('fotos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
