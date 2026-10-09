import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente para Server Components y API routes (requiere next/headers)
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component — las cookies se manejan en middleware
        }
      },
    },
  })
}

// Cliente con service_role para operaciones de admin/servidor (API routes)
export function createAdminSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type CookieASetear = { name: string; value: string; options: Record<string, unknown> }

/**
 * Cliente para Route Handlers que inician sesión (callback / confirm): las cookies de sesión se acumulan
 * en `salida` para copiarlas a la respuesta (redirect) que se devuelva.
 */
export function createRouteSupabase(req: NextRequest, salida: CookieASetear[]) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return req.cookies.getAll() },
      setAll(cs) {
        cs.forEach(({ name, value }) => req.cookies.set(name, value))
        salida.push(...(cs as CookieASetear[]))
      },
    },
  })
}
