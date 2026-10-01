import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valido: false })

  const admin = createAdminSupabase()
  const { data } = await admin
    .from('onboarding_tokens')
    .select('id, expires_at, usado')
    .eq('token', token)
    .single()

  if (!data) return NextResponse.json({ valido: false })
  if (data.usado) return NextResponse.json({ valido: false })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ valido: false })

  return NextResponse.json({ valido: true })
}
