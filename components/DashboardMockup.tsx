"use client";

import { useEffect, useState } from "react";

export default function DashboardMockup() {
  const [bp, setBp] = useState<"mobile" | "tablet" | "wide">("mobile");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setBp(w >= 1100 ? "wide" : w >= 768 ? "tablet" : "mobile");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isWide = bp === "wide";
  const isDesktop = bp === "tablet" || bp === "wide";

  return (
    <section
      style={{
        backgroundColor: "#2D1464",
        padding: "0 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isWide ? 56 : isDesktop ? 48 : 20,
        }}
      >
        {/* ── Left / Top: título + párrafo (tablet y mobile) ── */}
        <div style={{
          flex: 1,
          textAlign: isWide ? "right" : isDesktop ? "left" : "center",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          <h2
            style={{
              fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
              fontWeight: 800,
              fontSize: isWide ? 42 : isDesktop ? 38 : 30,
              lineHeight: 1.15,
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Así lo ves<br />desde donde estés
          </h2>
          {/* Párrafo: en left col para tablet y mobile, en right col para wide */}
          {!isWide && (
            <p style={{
              fontFamily: "var(--font-body, Inter, sans-serif)",
              fontSize: isDesktop ? 17 : 15,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.72)",
              margin: 0,
              maxWidth: isDesktop ? 360 : 320,
              alignSelf: isDesktop ? "flex-start" : "center",
            }}>
              Después de cada visita recibes el estado de tu familiar, en un reporte
              claro que no deja espacio para el &ldquo;¿cómo estará?&rdquo;
            </p>
          )}
        </div>

        {/* ── Center: teléfono ── */}
        <div style={{ flexShrink: 0, zoom: isDesktop ? 1 : 0.78 }}>
          <Phone />
        </div>

        {/* ── Right: párrafo solo en wide (≥1100px) ── */}
        {isWide && (
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{
              fontFamily: "var(--font-body, Inter, sans-serif)",
              fontSize: 18,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.72)",
              margin: 0,
              maxWidth: 320,
            }}>
              Después de cada visita recibes el estado de tu familiar, en un reporte
              claro que no deja espacio para el &ldquo;¿cómo estará?&rdquo;
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Phone frame ─────────────────────────────────────────────────── */
function Phone() {
  return (
    /* Outer shell: shows the box-shadow and the dark bezel */
    <div
      style={{
        width: 300,
        height: 690,
        borderRadius: 44,
        backgroundColor: "#0C0B14",
        boxShadow:
          "0 0 0 2px rgba(255,255,255,0.12), 0 0 0 6px #1A0A3C, 0 32px 80px rgba(0,0,0,0.6)",
        padding: 6,
        flexShrink: 0,
      }}
    >
      {/* Inner clip: hides screen content overflow */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 38,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <StatusBar />
        <NavBar />
        <Screen />
      </div>
    </div>
  );
}

/* ─── Status bar ──────────────────────────────────────────────────── */
function StatusBar() {
  return (
    <div
      style={{
        backgroundColor: "#2D1464",
        padding: "10px 18px 4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "white", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
        10:07
      </span>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {/* Signal */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="white">
          <rect x="0" y="7" width="3" height="4" rx="0.5" opacity="0.4" />
          <rect x="4" y="5" width="3" height="6" rx="0.5" opacity="0.6" />
          <rect x="8" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.8" />
          <rect x="12" y="0" width="3" height="11" rx="0.5" />
        </svg>
        {/* Wifi */}
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
          <path d="M7 9a1 1 0 100-2 1 1 0 000 2z" fill="white" />
          <path d="M3.5 6.5A4.93 4.93 0 017 5.5a4.93 4.93 0 013.5 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M1 4A7.93 7.93 0 017 2a7.93 7.93 0 016 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </svg>
        {/* Battery */}
        <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
          <rect x="0.5" y="0.5" width="16" height="10" rx="2.5" stroke="white" strokeOpacity="0.7" />
          <rect x="2" y="2" width="12" height="7" rx="1.5" fill="white" />
          <path d="M17.5 3.5v4a1.5 1.5 0 000-4z" fill="white" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

/* ─── Nav bar ─────────────────────────────────────────────────────── */
function NavBar() {
  return (
    <div
      style={{
        backgroundColor: "#2D1464",
        height: 36,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: "white" }}>
        com<span style={{ color: "#FF6B2B" }}>paz</span>
      </span>
      <div
        style={{
          backgroundColor: "#FF6B2B",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 10,
          fontWeight: 700,
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Únete
      </div>
    </div>
  );
}

/* ─── Scroll area ─────────────────────────────────────────────────── */
function Screen() {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#FDFAF6",
        overflowY: "hidden",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        position: "relative",
      }}
    >
      <PatientBanner />
      <StatTiles />
      <AlertCard />
      <RadarCard />
      <NoteCard />

    </div>
  );
}

/* ─── Patient banner ──────────────────────────────────────────────── */
function PatientBanner() {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 1px 4px rgba(26,10,60,0.07)",
      }}
    >
      {/* Row 1: avatar + nombre + compita */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              backgroundColor: "#2D1464",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              flexShrink: 0,
            }}
          >
            CR
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1A0A3C", fontFamily: "Inter, sans-serif" }}>
              Sra. Carmen Rodríguez
            </div>
            <div style={{ fontSize: 9.5, color: "#6B5E8A", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
              78 años · Chacao, Caracas
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#F0EBF8",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 8.5,
            color: "#2D1464",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
            textAlign: "right",
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          Ana Colmenares<br />4.9 ★ · Verificada
        </div>
      </div>
      {/* Row 2: contacto a ancho completo */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 7,
          borderTop: "1px solid #F0EBF8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 9.5, color: "#6B5E8A", fontFamily: "Inter, sans-serif" }}>
          Miguel Rodríguez <span style={{ color: "#A094B7" }}>· contacto</span>
        </span>
        <span style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ─── Stat tiles ──────────────────────────────────────────────────── */
function StatTiles() {
  const tiles = [
    { value: "8", label: "VISITAS" },
    { value: "6d", label: "ÚLTIMA VISITA" },
    { value: "✓ OK", label: "", green: true },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            backgroundColor: t.green ? "#D1FAE5" : "white",
            borderRadius: 10,
            padding: "8px 6px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 4px rgba(26,10,60,0.07)",
          }}
        >
          <div
            style={{
              fontSize: t.green ? 14 : 16,
              fontWeight: 800,
              color: t.green ? "#065F46" : "#1A0A3C",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {t.value}
          </div>
          {t.label && (
            <div style={{ fontSize: 7.5, color: "#6B5E8A", fontFamily: "Inter, sans-serif", marginTop: 1, letterSpacing: "0.04em" }}>
              {t.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Home alert card ─────────────────────────────────────────────── */
function AlertCard() {
  return (
    <div
      style={{
        backgroundColor: "#FEF3C7",
        border: "1.5px solid #FCD34D",
        borderRadius: 10,
        padding: "9px 10px",
        boxShadow: "0 1px 4px rgba(26,10,60,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 22,
              height: 22,
              backgroundColor: "#FCD34D",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            🏠
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309", fontFamily: "Inter, sans-serif" }}>
            Observaciones del hogar
          </span>
        </div>
        <span
          style={{
            backgroundColor: "#92400E",
            color: "white",
            fontSize: 7.5,
            fontWeight: 700,
            borderRadius: 5,
            padding: "2px 5px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          1 ITEM
        </span>
      </div>
      <p style={{ fontSize: 9.5, color: "#78350F", fontFamily: "Inter, sans-serif", lineHeight: 1.4, margin: 0, marginBottom: 5 }}>
        Bombillo quemado en la sala. La lámpara principal no enciende.
      </p>
      <p style={{ fontSize: 9, color: "#92400E", fontFamily: "Inter, sans-serif", fontStyle: "italic", margin: 0, lineHeight: 1.3 }}>
        Ana: Le comenté a Carmen. Me dijo que Miguel ya lo sabe.
      </p>
    </div>
  );
}

/* ─── Radar card ──────────────────────────────────────────────────── */
function RadarCard() {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 10,
        padding: "10px",
        boxShadow: "0 1px 4px rgba(26,10,60,0.07)",
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1A0A3C", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
        Estado general · última visita
      </div>
      <svg viewBox="-25 0 270 205" width="100%" height="148" style={{ display: "block" }}>
        {/* Grid polygons */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={scalePolygon(RADAR_POINTS, scale)}
            fill="none"
            stroke="#E8E0D4"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {RADAR_POINTS.map((p, i) => (
          <line
            key={i}
            x1={CENTER[0]} y1={CENTER[1]}
            x2={p[0]} y2={p[1]}
            stroke="#E8E0D4"
            strokeWidth="1"
          />
        ))}
        {/* Data polygon */}
        <polygon
          points={DATA_POINTS.map((p) => p.join(",")).join(" ")}
          fill="#FF6B2B"
          fillOpacity="0.15"
          stroke="#FF6B2B"
          strokeWidth="1.5"
        />
        {DATA_POINTS.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#FF6B2B" />
        ))}
        {/* Labels */}
        {LABELS.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            fontSize="9"
            fill="#6B5E8A"
            fontFamily="Inter, sans-serif"
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

const CENTER: [number, number] = [110, 100];
const RADAR_POINTS: [number, number][] = [
  [110, 41],
  [170.9, 85.2],
  [147.6, 156.8],
  [62.9, 169.7],
  [33.9, 80.3],
];
const DATA_POINTS: [number, number][] = RADAR_POINTS; // full score for mockup

function scalePolygon(pts: [number, number][], s: number): string {
  return pts
    .map(([x, y]) => [CENTER[0] + (x - CENTER[0]) * s, CENTER[1] + (y - CENTER[1]) * s])
    .map((p) => p.join(","))
    .join(" ");
}

const LABELS: { x: number; y: number; anchor: "middle" | "start" | "end"; text: string }[] = [
  { x: 110, y: 32,  anchor: "middle", text: "Ánimo" },
  { x: 178, y: 85,  anchor: "start",  text: "Movilidad" },
  { x: 158, y: 168, anchor: "start",  text: "Lucidez" },
  { x: 60,  y: 182, anchor: "end",    text: "Apetito" },
  { x: 26,  y: 80,  anchor: "end",    text: "Higiene" },
];

/* ─── Note card ───────────────────────────────────────────────────── */
function NoteCard() {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 1px 4px rgba(26,10,60,0.07)",
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1A0A3C", fontFamily: "Inter, sans-serif", marginBottom: 5 }}>
        Nota de Ana · 4 de julio · ⏱ 1h 52min
      </div>
      <p
        style={{
          fontSize: 9.5,
          color: "#3D2E6B",
          fontFamily: "Inter, sans-serif",
          fontStyle: "italic",
          lineHeight: 1.45,
          margin: 0,
          marginBottom: 6,
        }}
      >
        Muy animada hoy. Hablamos de sus nietos y vimos las noticias. Comió bien.
      </p>
      <div style={{ fontSize: 8.5, color: "#6B5E8A", fontFamily: "Inter, sans-serif" }}>
        — Ana Colmenares, Compita verificada
      </div>
    </div>
  );
}
