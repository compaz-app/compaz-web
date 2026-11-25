'use client'

import { useSyncExternalStore } from 'react'
import { CLAVE_COOKIES, codificarDecision, leerDecision, type DecisionCookies } from '@/lib/consentimiento'

// La decisión de cookies, en el navegador. Si el navegador no deja guardar (modo privado), se recuerda mientras la pestaña siga abierta. Se avisa a todos los
// componentes que la miran (el aviso y los scripts) con un evento, para que reaccionen al instante sin recargar.
const EVENTO = 'compaz-cookies'
let enMemoria: string | null = null

const leerCrudo = (): string | null => { try { return window.localStorage.getItem(CLAVE_COOKIES) ?? enMemoria } catch { return enMemoria } }
const suscribir = (cb: () => void) => { window.addEventListener(EVENTO, cb); window.addEventListener('storage', cb); return () => { window.removeEventListener(EVENTO, cb); window.removeEventListener('storage', cb) } }

/** 'si' | 'no' | 'pendiente' (hay que preguntar) | 'desconocido' (todavía no se sabe: en el servidor o antes de montar). */
export function useDecisionCookies(): DecisionCookies | 'pendiente' | 'desconocido' {
  return useSyncExternalStore(suscribir, () => leerDecision(leerCrudo()) ?? 'pendiente', () => 'desconocido')
}

export function guardarDecisionCookies(d: DecisionCookies): void {
  const crudo = codificarDecision(d)
  enMemoria = crudo
  try { window.localStorage.setItem(CLAVE_COOKIES, crudo) } catch { /* sin almacenamiento: queda en memoria */ }
  window.dispatchEvent(new Event(EVENTO))
}

export function olvidarDecisionCookies(): void {
  enMemoria = null
  try { window.localStorage.removeItem(CLAVE_COOKIES) } catch { /* nada */ }
  window.dispatchEvent(new Event(EVENTO))
}
