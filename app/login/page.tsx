import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { rutaInterna } from '@/lib/html'
import LoginForm from './LoginForm'

// Si ya hay una sesión, la persona entra directo a donde iba (o a su portal) sin que se le pida el correo otra vez.
// Con un error en la dirección (cuenta suspendida, enlace vencido) se muestra el formulario para que lo vea.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string; motivo?: string }> }) {
  const params = await searchParams
  if (!params.error) {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect(isAdminEmail(user.email ?? '') ? '/panel' : rutaInterna(params.returnTo, '/dashboard'))
  }
  return <LoginForm returnTo={rutaInterna(params.returnTo, '')} error={params.error} motivo={params.motivo} />
}
