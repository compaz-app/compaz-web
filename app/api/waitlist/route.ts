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
  // Permitir previews de Netlify: *.netlify.app
  if (/^https:\/\/[a-z0-9-]+--compaz.*\.netlify\.app$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── Preflight OPTIONS ─────────────────────────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  const origin = getAllowedOrigin(req);
  if (!origin) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Rate limiting in-memory ───────────────────────────────────────────────────
// Nota: en serverless cada instancia tiene su propio contador. La primera línea
// de defensa real es Cloudflare Turnstile; esto es una capa adicional.
const RATE_LIMIT_MAX = 3;
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
    // Sin clave configurada → pasar (modo dev / sin Turnstile)
    return true;
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
const MAX_LEN = { nombre: 100, contacto: 200, ciudad: 100 };

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function isValidContacto(value: string): boolean {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phone = /^[\d\s+()-]{6,20}$/;
  return email.test(value) || phone.test(value);
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
  const ciudadRaw = typeof body.ciudad === "string" ? body.ciudad : "";

  const nombre = stripHtml(nombreRaw).slice(0, MAX_LEN.nombre);
  const contacto = stripHtml(contactoRaw).slice(0, MAX_LEN.contacto);
  const ciudad = stripHtml(ciudadRaw).slice(0, MAX_LEN.ciudad);

  if (!nombre || !contacto || !ciudad) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400, headers });
  }

  if (!isValidContacto(contacto)) {
    return NextResponse.json(
      { error: "El contacto debe ser un email o teléfono válido" },
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
