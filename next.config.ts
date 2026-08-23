import type { NextConfig } from "next";

// Headers de seguridad definidos aquí como fuente de verdad única.
// Con @netlify/plugin-nextjs, los [[headers]] de netlify.toml se aplican
// a TODAS las respuestas (incluidas páginas dinámicas), así que duplicarlos
// ahí haría que el navegador recibiera dos cabeceras CSP. Solo se usan aquí.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "frame-src https://challenges.cloudflare.com https://www.youtube.com; " +
      "connect-src 'self' https://api.airtable.com https://www.facebook.com https://challenges.cloudflare.com https://www.google-analytics.com https://analytics.google.com https://www.clarity.ms https://*.clarity.ms; " +
      "frame-ancestors 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
