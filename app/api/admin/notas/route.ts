import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { agregarNota } from '@/lib/panel-notas'
import { esTipoPersona } from '@/lib/panel-personas-tipos'
import { ok, err } from '@/lib/api'

// POST /api/admin/notas { tipo, id, texto } — agrega una nota interna a la ficha de un cliente o compita. Queda con el correo de quien la escribió.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { tipo?: unknown; id?: unknown; texto?: unknown } | null
  if (!b || !esTipoPersona(b.tipo) || typeof b.id !== 'string' || !/^[0-9a-zA-Z-]{8,64}$/.test(b.id)) return err('Faltan campos requeridos')
  const r = await agregarNota(g.actor, { tipo: b.tipo, id: b.id, texto: b.texto })
  return r.ok ? ok(r.nota) : err(r.error, r.status)
}
