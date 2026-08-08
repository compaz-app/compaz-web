import { NextRequest, NextResponse } from "next/server";

// --- Rate limiting: max 3 submissions per IP per hour ---
// In-memory store. Resets on cold start, which is an accepted tradeoff for
// a low-traffic beta launch on Netlify Functions (no external dependency needed).
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
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
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = req.headers.get("x-nf-client-connection-ip");
  if (realIp) return realIp;
  return "unknown";
}

// --- Input validation & sanitization ---
const MAX_LEN = { nombre: 100, contacto: 200, ciudad: 100 };

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function isValidContacto(value: string): boolean {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phone = /^[\d\s+()-]{6,20}$/;
  return email.test(value) || phone.test(value);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  let body: { nombre?: unknown; contacto?: unknown; ciudad?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const nombreRaw = typeof body.nombre === "string" ? body.nombre : "";
  const contactoRaw = typeof body.contacto === "string" ? body.contacto : "";
  const ciudadRaw = typeof body.ciudad === "string" ? body.ciudad : "";

  const nombre = stripHtml(nombreRaw).slice(0, MAX_LEN.nombre);
  const contacto = stripHtml(contactoRaw).slice(0, MAX_LEN.contacto);
  const ciudad = stripHtml(ciudadRaw).slice(0, MAX_LEN.ciudad);

  if (!nombre || !contacto || !ciudad) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  if (!isValidContacto(contacto)) {
    return NextResponse.json(
      { error: "El contacto debe ser un email o teléfono válido" },
      { status: 400 }
    );
  }

  const airtableKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME ?? "Lista de Espera";

  if (!airtableKey || !baseId) {
    // Fallback: log and succeed so the form works even before Airtable is connected.
    console.log("Waitlist entry (no Airtable config):", { nombre, contacto, ciudad });
    return NextResponse.json({ ok: true });
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
        fields: {
          Nombre: nombre,
          Contacto: contacto,
          Ciudad: ciudad,
          Fecha: new Date().toISOString(),
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Airtable error:", err);
    return NextResponse.json({ error: "Error guardando" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
