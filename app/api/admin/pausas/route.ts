// GET lista las cuentas en pausa por compartir contactos (la más antigua primero); PATCH { id, decision } decide: reactivar, otra_oportunidad o bloquear.
// Requiere el permiso de cuentas (el mismo que bloquear a alguien).
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { pausasActivas, decidirPausa, DECISIONES_PAUSA, type DecisionPausa } from '@/lib/pausas'
import { ok, err, notFound } from '@/lib/api'

export async function GET() {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res
  return ok(await pausasActivas())
}

export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { id?: unknown; decision?: unknown } | null
  if (!b || typeof b.id !== 'string' || !(DECISIONES_PAUSA as readonly unknown[]).includes(b.decision)) return err('Faltan datos de la decisión', 400)
  return (await decidirPausa(b.id, b.decision as DecisionPausa, g.actor.correo ?? 'equipo')) ? ok({ decidida: true }) : notFound('Pausa no encontrada o ya decidida')
}
