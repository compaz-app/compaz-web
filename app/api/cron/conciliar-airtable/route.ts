// POST /api/cron/conciliar-airtable — Netlify Scheduled Function cada hora
// Importa a Supabase los registros de Airtable creados desde la activación
// (CAPTACION_DESDE) que Supabase no tenga vinculados: los que la web guardó solo en
// Airtable porque Supabase falló, y las copias cuya confirmación se perdió. No toca
// el histórico anterior a CAPTACION_DESDE ni modifica Airtable (solo lee).
import { NextRequest } from 'next/server'
import { conciliarAirtable } from '@/lib/captacion'
import { airtableConfigurado } from '@/lib/airtable'
import { avisarAdmin } from '@/lib/telegram'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)
  if (process.env.POSTULACIONES_DESTINO !== 'supabase_y_airtable') return ok({ desactivado: true })
  const desde = process.env.CAPTACION_DESDE ?? ''
  if (!airtableConfigurado() || Number.isNaN(Date.parse(desde))) return err('Falta AIRTABLE_* o CAPTACION_DESDE (fecha ISO)', 500)

  try {
    const r = await conciliarAirtable(desde)
    for (const id of r.ilegibles) {
      if (await reclamarUnaVez(`alerta_ilegible:${id}`)) {
        await avisarAdmin(`⚠️ <b>Registro de Airtable sin importar</b>\n\n${id} no tiene el formato "WA: … | Email: … | Rol: …" y no se pudo pasar a Supabase. Revísalo a mano.`)
      }
    }
    if (r.ambigua > 0 && (await reclamarUnaVez(`alerta_ambigua:${new Date().toISOString().slice(0, 10)}`))) {
      await avisarAdmin(`⚠️ <b>Conciliación con Airtable</b>\n\n${r.ambigua} registro(s) coinciden con más de una postulación y no se vincularon. Revisa los eventos "airtable_conciliacion_ambigua".`)
    }
    await latido('conciliar-airtable')
    return ok({ ...r, ilegibles: r.ilegibles.length })
  } catch (e) {
    console.error('[conciliar-airtable]', e)
    return err('Fallo en la conciliación', 500)
  }
}
