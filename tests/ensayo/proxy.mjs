// Ensayo de Luis · puerta de acceso delante de la web (solo para el ensayo, no se fusiona).
// - Exige usuario y contraseña (HTTP Basic sobre HTTPS) con una contraseña aleatoria de esta ejecución.
// - Tras 10 intentos fallidos cierra el acceso para todos (403).
// - Añade una CSP más estricta: el navegador no puede cargar analítica de producción (Clarity, Meta, Google).
// - Registra solo método, ruta y código de respuesta de /api/waitlist (sin datos personales).
import http from 'node:http'
import { appendFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'

const CLAVE = process.env.ENSAYO_CLAVE ?? ''
if (CLAVE.length < 20) { console.error('falta ENSAYO_CLAVE'); process.exit(1) }
const ESPERADO = Buffer.from('Basic ' + Buffer.from(`luis:${CLAVE}`).toString('base64'))
const REGISTRO = process.env.ENSAYO_REGISTRO ?? '/tmp/ensayo-solicitudes.log'
const CSP = "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data: blob:; media-src 'self'"
let fallos = 0

const autorizado = (h) => { const b = Buffer.from(h ?? ''); return b.length === ESPERADO.length && timingSafeEqual(b, ESPERADO) }

http.createServer((req, res) => {
  if (fallos >= 10) { res.writeHead(403); return res.end('Acceso cerrado') }
  if (!autorizado(req.headers.authorization)) {
    if (req.headers.authorization) fallos++
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Ensayo Compaz", charset="UTF-8"' })
    return res.end('Se necesita la contraseña del ensayo')
  }
  const { authorization, ...headers } = req.headers
  const sub = http.request({ host: '127.0.0.1', port: 3000, method: req.method, path: req.url, headers }, (r) => {
    if (req.url?.startsWith('/api/waitlist') && req.method === 'POST') appendFileSync(REGISTRO, `${new Date().toISOString()} POST /api/waitlist ${r.statusCode}\n`)
    const h = { ...r.headers, 'content-security-policy': [r.headers['content-security-policy'], CSP].flat().filter(Boolean) }
    res.writeHead(r.statusCode ?? 502, h)
    r.pipe(res)
  })
  sub.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('La web del ensayo no responde') })
  req.pipe(sub)
}).listen(8080, '127.0.0.1', () => console.log('puerta del ensayo en 127.0.0.1:8080'))
