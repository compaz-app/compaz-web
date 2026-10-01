import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente para el navegador — seguro importar desde Client Components
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
