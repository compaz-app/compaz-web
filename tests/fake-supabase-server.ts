/* eslint-disable */
import { FakeDB, makeClient } from './fake-db'

export const db = new FakeDB()
export const session: { user: { id: string; email: string } | null } = { user: null }

// Reemplaza a lib/supabase-server.ts en los tests (service_role no emula RLS: la RLS se revisa en el SQL).
export function createAdminSupabase() { return makeClient(db, () => null) as any }
export async function createServerSupabase() { return makeClient(db, () => session.user) as any }
