import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { revelarContacto } from '@/lib/panel-personas'
import { CANALES, esTipoContacto, type CanalContacto } from '@/lib/panel-personas-tipos'
import { ok, err } from '@/lib/api'

// POST /api/admin/contacto { tipo, id, canal, motivo } — entrega un dato de contacto (correo o teléfono) y deja anotado quién y por qué.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('telefonos')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { tipo?: unknown; id?: unknown; canal?: unknown; motivo?: unknown } | null
  if (!b || !esTipoContacto(b.tipo) || typeof b.id !== 'string' || !/^[0-9a-zA-Z-]{8,64}$/.test(b.id) || !(CANALES as readonly unknown[]).includes(b.canal)) return err('Faltan campos requeridos')
  const r = await revelarContacto(g.actor, { tipo: b.tipo, id: b.id, canal: b.canal as CanalContacto, motivo: b.motivo })
  return r.ok ? ok({ valor: r.valor, detalle: r.detalle ?? null }) : err(r.error, r.status)
}
