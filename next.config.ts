import type { NextConfig } from "next";

// Headers de seguridad. Se definen aquí (y no solo en netlify.toml) porque los
// [[headers]] de netlify.toml NO se aplican a las páginas que renderiza Next.js
// (solo a los archivos estáticos). Definidos aquí, el runtime de Next los pone
// en TODAS las respuestas — incluida la home y /api/waitlist.
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
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://t.contentsquare.net https://edge.fullstory.com https://www.clarity.ms; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://challenges.cloudflare.com https://www.youtube.com; connect-src 'self' https://api.airtable.com https://www.facebook.com https://challenges.cloudflare.com https://www.google-analytics.com https://analytics.google.com https://t.contentsquare.net https://rs.fullstory.com https://www.clarity.ms; frame-ancestors 'none'",
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
