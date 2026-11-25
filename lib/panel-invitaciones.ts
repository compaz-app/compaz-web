// Invitados que todavía no abrieron el correo ni activaron su cuenta (usuarios.activado = false). No son clientes: no salen en Clientes ni en Seguimiento. Se ven
// en Más, Invitar, donde se les puede reenviar la invitación. Solo lo ve quien tiene el permiso de invitar (el correo es dato de contacto).
import { createAdminSupabase } from '@/lib/supabase-server'

export interface InvitadoPendiente { id: string; nombre: string; correo: string; invitado: string }

export async function listarInvitadosPendientes(limite = 100): Promise<InvitadoPendiente[]> {
  const { data, error } = await createAdminSupabase().from('usuarios').select('id, nombre, email, created_at, eliminada_en')
    .eq('activado', false).order('created_at', { ascending: false }).limit(limite)
  if (error) { console.error('[invitaciones] no se pudo leer:', error.message); return [] }
  return ((data ?? []) as { id: string; nombre: string | null; email: string | null; created_at: string; eliminada_en: string | null }[])
    .filter((u) => !u.eliminada_en && u.email)
    .map((u) => ({ id: String(u.id), nombre: String(u.nombre ?? ''), correo: String(u.email), invitado: String(u.created_at) }))
}
