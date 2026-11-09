'use client'
import { createContext, createElement, useCallback, useContext, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Dentro del recorrido guiado cada pantalla vive en su propio estado en memoria (EmbedProvider),
// así se pueden ver varias a la vez sin tocar la URL. Fuera del recorrido el estado va en la URL.
type Embed = { vals: Record<string, string>; set: (k: string, v: string | null) => void }
const Ctx = createContext<Embed | null>(null)

export function EmbedProvider({ params, children }: { params: Record<string, string>; children: React.ReactNode }) {
  const [vals, setVals] = useState(params)
  const set = useCallback((k: string, v: string | null) => setVals((o) => {
    const n = { ...o }
    if (v == null) delete n[k]
    else n[k] = v
    return n
  }), [])
  return createElement(Ctx.Provider, { value: { vals, set } }, children)
}

export function useParam(key: string): string | null {
  const c = useContext(Ctx)
  const sp = useSearchParams()
  return c ? c.vals[key] ?? null : sp.get(key)
}

// Estado guardado en la URL para que un refresh conserve la pantalla (solo prototipo).
export function useUrlState(key: string, def: string) {
  const embed = useContext(Ctx)
  const sp = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const value = (embed ? embed.vals[key] : sp.get(key)) ?? def
  const set = useCallback(
    (v: string | null) => {
      const vacio = v == null || v === def
      if (embed) { embed.set(key, vacio ? null : v); return }
      const p = new URLSearchParams(sp.toString())
      if (vacio) p.delete(key)
      else p.set(key, v as string)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [embed, sp, pathname, router, key, def],
  )
  return [value, set] as const
}

// true cuando la pantalla va dentro del recorrido guiado (ahí se ocultan los controles y notas del prototipo).
export function useEmbedded(): boolean {
  return useContext(Ctx) !== null
}
