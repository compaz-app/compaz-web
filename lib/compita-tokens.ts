import { createAdminSupabase } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

const TTL_HORAS = 24

export async function generarTokenPerfil(compitaId: string): Promise<string> {
  const supabase = createAdminSupabase()
  const token = randomUUID()
  const expires_at = new Date(Date.now() + TTL_HORAS * 60 * 60 * 1000).toISOString()

  // Invalidar tokens previos no usados del mismo compita
  await supabase
    .from('compita_edit_tokens')
    .update({ usado: true })
    .eq('compita_id', compitaId)
    .eq('usado', false)

  const { error } = await supabase
    .from('compita_edit_tokens')
    .insert({ token, compita_id: compitaId, expires_at, usado: false })

  if (error) throw new Error(`Error guardando token de perfil: ${error.message}`)

  return token
}

export async function validarTokenPerfil(token: string): Promise<string | null> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('compita_edit_tokens')
    .select('id, compita_id, expires_at, usado')
    .eq('token', token)
    .single()

  if (!data || data.usado || new Date(data.expires_at) < new Date()) return null
  return data.compita_id as string
}

export async function consumirTokenPerfil(token: string): Promise<string | null> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('compita_edit_tokens')
    .update({ usado: true })
    .eq('token', token)
    .eq('usado', false)
    .select('compita_id')
    .single()

  return data ? (data.compita_id as string) : null
}
