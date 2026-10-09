// Empaqueta cada tests/*.test.ts con esbuild (alias @/ y BD falsa) y los ejecuta con node:test.
import { build } from 'esbuild'
import { readdirSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, '.tests-dist')
rmSync(out, { recursive: true, force: true }); mkdirSync(out)

const filtro = process.argv[2]
const files = readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.ts') && (!filtro || f.includes(filtro)))

const aliasPlugin = {
  name: 'alias',
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase-server$/ }, () => ({ path: path.join(root, 'tests/fake-supabase-server.ts') }))
    b.onResolve({ filter: /^@\// }, (a) => {
      const base = path.join(root, a.path.slice(2))
      for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
        try { if (require_exists(base + ext)) return { path: base + ext } } catch {}
      }
      return { path: base + '.ts' }
    })
  },
}
import { statSync } from 'node:fs'
function require_exists(p) { try { return statSync(p).isFile() } catch { return false } }

await build({
  entryPoints: files.map((f) => path.join(root, 'tests', f)),
  outdir: out, bundle: true, platform: 'node', format: 'cjs', outExtension: { '.js': '.cjs' },
  external: ['next', 'next/*', 'react', 'react-dom', 'resend', '@anthropic-ai/sdk', 'esbuild'],
  plugins: [aliasPlugin], logLevel: 'error', sourcemap: 'inline',
})

const r = spawnSync(process.execPath, ['--enable-source-maps', '--test', '--test-concurrency=1', ...files.map((f) => path.join(out, f.replace('.ts', '.cjs')))], { stdio: 'inherit', cwd: root })
process.exit(r.status ?? 1)
