import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requierePermiso } from '@/lib/permisos'
import { tipoImagenReal, EXT } from '@/lib/imagen'
import { subirFotoCompita } from '@/lib/acciones-equipo'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

// POST /api/admin/upload-foto (multipart: foto, nombre) — sube la foto de perfil de un compita. Se comprueba que el archivo sea de verdad una imagen.
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
  const r = await subirFotoCompita(buffer, tipo, EXT[tipo], nombre)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
