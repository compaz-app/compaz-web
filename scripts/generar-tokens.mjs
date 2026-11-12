// Genera app/tokens.generated.css a partir de lib/design.ts (la ÚNICA fuente de los colores).
// Así Tailwind (bg-naranja, text-morado-profundo...) y los estilos en línea usan exactamente los mismos valores.
// Uso: node scripts/generar-tokens.mjs        (la prueba tests/56-estilos.test.ts falla si el archivo quedó desactualizado)
import { writeFileSync } from 'node:fs'
import { colors, shadows } from '../lib/design.ts'

const kebab = (k) => k.replace(/([A-Z])/g, '-$1').toLowerCase()

export function generarCss() {
  const c = Object.entries(colors).map(([k, v]) => `  --color-${kebab(k)}: ${v};`).join('\n')
  const s = Object.entries(shadows).map(([k, v]) => `  --shadow-${kebab(k)}: ${v};`).join('\n')
  return `/* ARCHIVO GENERADO por scripts/generar-tokens.mjs desde lib/design.ts. No editar a mano: edita lib/design.ts y vuelve a generar. */
@theme static {
${c}
${s}
}
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('../app/tokens.generated.css', import.meta.url), generarCss())
  console.log('app/tokens.generated.css actualizado')
}
