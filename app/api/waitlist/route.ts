import { NextRequest, NextResponse } from "next/server";

// ── Dominios permitidos (CORS) ────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://elcompaz.com",
  "https://www.elcompaz.com",
  "https://micompaz.com",
  "https://www.micompaz.com",
  "https://compaz-beta.netlify.app",
  // Netlify deploy previews (ramas)
];

function getAllowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Solo deploy previews del repo compaz-web (formato exacto de Netlify CI)
  if (/^https:\/\/deploy-preview-\d+--compaz-web\.netlify\.app$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── Preflight OPTIONS ────────────────────────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  const origin = getAllowedOrigin(req);
  if (!origin) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Rate limiting in-memory ──────────────────────────────────────────────────
// Nota: en serverless cada instancia tiene su propio contador. La primera línea
// de defensa real es Cloudflare Turnstile; esto es una capa adicional.
// En serverless cada instancia tiene su propio contador, así que el límite real
// puede ser RATE_LIMIT_MAX × número de instancias activas. Turnstile es la defensa
// principal; esto es una capa adicional para el caso en que Turnstile falle.
// Bajado a 1 para que incluso con múltiples instancias el abuse sea mínimo.
const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

// ── Verificación Cloudflare Turnstile ────────────────────────────────────────
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Sin clave configurada:
    //  - En desarrollo local → pasar, para poder probar el formulario sin Turnstile.
    //  - En producción → RECHAZAR (fail-closed). Si la clave falta o se borra por
    //    error en Netlify, el formulario se cierra en vez de quedar abierto a bots.
    return process.env.NODE_ENV !== "production";
  }
  if (!token) return false;

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    }
  );
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

// ── Sanitización ──────────────────────────────────────────────────────────────
const MAX_LEN = { nombre: 100, contacto: 200, ciudad: 100, whatsapp: 30, email: 100 };

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  return /^[\d\s+()-]{6,20}$/.test(value);
}

// ── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const origin = getAllowedOrigin(req);
  const headers = origin ? corsHeaders(origin) : {};

  const ip = getClientIp(req);

  // 1. Rate limiting
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers }
    );
  }

  // 2. Parsear body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400, headers });
  }

  // 3. Honeypot
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { headers });
  }

  // 4. Verificar Turnstile (servidor)
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  const humanVerified = await verifyTurnstile(turnstileToken, ip);
  if (!humanVerified) {
    return NextResponse.json(
      { error: "Verificación fallida. Por favor recarga la página e intenta de nuevo." },
      { status: 403, headers }
    );
  }

  // 5. Validar campos
  const nombreRaw = typeof body.nombre === "string" ? body.nombre : "";
  const contactoRaw = typeof body.contacto === "string" ? body.contacto : "";
  const whatsappRaw = typeof body.whatsapp === "string" ? body.whatsapp : "";
  const emailRaw = typeof body.email === "string" ? body.email : "";
  const ciudadRaw = typeof body.ciudad === "string" ? body.ciudad : "";

  const nombre = stripHtml(nombreRaw).slice(0, MAX_LEN.nombre);
  const contacto = stripHtml(contactoRaw).slice(0, MAX_LEN.contacto);
  const whatsapp = stripHtml(whatsappRaw).slice(0, MAX_LEN.whatsapp);
  const email = stripHtml(emailRaw).slice(0, MAX_LEN.email);
  const ciudad = stripHtml(ciudadRaw).slice(0, MAX_LEN.ciudad);

  if (!nombre || !contacto || !ciudad || !whatsapp || !email) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400, headers });
  }

  if (!isValidPhone(whatsapp) || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Revisa el WhatsApp y el email" },
      { status: 400, headers }
   );
  }

  // 6. Guardar en Airtable
  const airtableKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME ?? "Lista de Espera";

  if (!airtableKey || !baseId) {
    console.log("Waitlist entry (sin Airtable):", { nombre, contacto, ciudad });
    return NextResponse.json({ ok: true }, { headers });
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${airtableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: { Nombre: nombre, Contacto: contacto, Ciudad: ciudad, Fecha: new Date().toISOString() },
      }),
    }
  );

  if (!res.ok) {
    console.error("Airtable error:", await res.text());
    return NextResponse.json({ error: "Error guardando" }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { headers });
}
