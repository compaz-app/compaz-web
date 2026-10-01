import { getCompitasActivas } from '@/lib/compitas'
import { ok, serverError } from '@/lib/api'

export async function GET() {
  try {
    const compitas = await getCompitasActivas()
    const zonas = [...new Set(compitas.map((c) => c.zona).filter(Boolean))]
    return ok({ zonas })
  } catch (e) {
    return serverError(e)
  }
}
