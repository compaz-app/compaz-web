// Puerta de confirmación: los GET que cambian estado muestran un botón y la acción real va por POST.
// Evita que escáneres de correo/Telegram (que hacen GET a todos los enlaces) disparen acciones.
import { NextRequest, NextResponse } from 'next/server'
import { esc } from '@/lib/html'

export function paginaHtml(titulo: string, cuerpoHtml: string, status = 200): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex"><title>${esc(titulo)} — Compaz</title>
    <style>body{font-family:Inter,sans-serif;background:#FDFAF6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box}
    .card{background:white;border:2px solid #E8E0D4;border-radius:24px;padding:40px 32px;max-width:480px;width:100%;text-align:center}
    h2{color:#1A0A3C;font-weight:800;font-size:22px;margin:0 0 12px}p{color:#4A3B6B;line-height:1.6;font-size:15px}
    .btn{display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;border:0;cursor:pointer;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px}</style></head>
    <body><div class="card"><h2>${esc(titulo)}</h2>${cuerpoHtml}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

export type RolPagina = 'cliente' | 'compita'

/**
 * El botón para volver, según QUIÉN está viendo la página. El cliente vuelve a su portal; el compita trabaja desde Telegram, así que vuelve al bot
 * (y si no hay bot configurado, no se muestra ningún botón). Antes TODA página con éxito llevaba «Ir a mi portal», también la del compita: lo mandaba
 * al portal del cliente, que no es suyo.
 */
export function botonDe(rol: RolPagina): { texto: string; href: string } | undefined {
  if (rol === 'cliente') return { texto: '← Ir a mi portal', href: '/dashboard' }
  const bot = (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '').trim()
  return bot ? { texto: 'Volver a Telegram', href: `https://t.me/${bot}` } : undefined
}

/** Página de resultado SIN botón de regreso (a menos que se pase uno). Para saber a quién se le muestra, usa `paginaPara`. */
export function pagina(titulo: string, texto: string, status = 200, boton?: { texto: string; href: string }): NextResponse {
  return paginaHtml(
    titulo,
    `<p>${esc(texto)}</p>${boton ? `<a class="btn" href="${esc(boton.href)}">${esc(boton.texto)}</a>` : ''}`,
    status,
  )
}

/** Página de resultado para un rol: con éxito lleva el botón de regreso de ese rol; los errores no llevan botón. */
export function paginaPara(rol: RolPagina, titulo: string, texto: string, status = 200, boton?: { texto: string; href: string }): NextResponse {
  return pagina(titulo, texto, status, boton ?? (status === 200 ? botonDe(rol) : undefined))
}

/** Página intermedia: botón que hace POST a la misma URL (con su query string). */
export function puertaConfirmacion(req: NextRequest, titulo: string, texto: string, boton: string): NextResponse {
  const action = req.nextUrl.pathname + req.nextUrl.search
  const textoEsc = esc(boton)
  return paginaHtml(
    titulo,
    `<p>${esc(texto)}</p>
<form method="POST" action="${esc(action)}" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Entrando…';">
  <button class="btn" type="submit">${textoEsc}</button>
</form>`,
  )
}
