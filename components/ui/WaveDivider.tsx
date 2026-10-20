// Divisor ondulado entre secciones de color (firma visual de las landings públicas).
// DESIGN.md: máximo 3 por página.

const WAVE_PATHS: Record<number, string> = {
  1: "M0,60 C480,0 960,0 1440,60 L1440,80 L0,80 Z",       // cóncava (baja al centro)
  2: "M0,20 C480,80 960,80 1440,20 L1440,80 L0,80 Z",      // convexa (sube al centro)
  3: "M0,0 C480,0 1200,80 1440,80 L1440,80 L0,80 Z",       // inclinada izquierda→derecha
  4: "M0,80 C240,80 960,0 1440,0 L1440,80 L0,80 Z",        // inclinada derecha→izquierda
  5: "M0,40 C600,80 840,0 1440,40 L1440,80 L0,80 Z",       // suave asimétrica
};

export default function WaveDivider({ from, to, shape, flip = false }: { from: string; to: string; shape: 1 | 2 | 3 | 4 | 5; flip?: boolean }) {
  return (
    <div style={{ backgroundColor: from, lineHeight: 0, fontSize: 0 }}>
      <svg
        viewBox="0 0 1440 80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full block h-10 sm:h-14 lg:h-16"
        style={flip ? { transform: "scaleX(-1)" } : undefined}
        aria-hidden="true"
      >
        <path d={WAVE_PATHS[shape]} fill={to} />
      </svg>
    </div>
  );
}

