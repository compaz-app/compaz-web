'use client'

import { createBrowserSupabase } from '@/lib/supabase'

export default function LogoutButton({ style }: { style?: React.CSSProperties }) {
  async function logout() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={logout}
      style={{
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        padding: '4px 8px',
        borderRadius: '6px',
        ...style,
      }}
    >
      Cerrar sesión
    </button>
  )
}
