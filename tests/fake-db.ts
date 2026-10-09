/* eslint-disable */
// BD en memoria que imita el subconjunto de supabase-js/PostgREST que usa Compaz.
// Semántica fiel donde importa: neq/lt/gt excluyen NULL, .single() exige 1 fila, índices únicos parciales.
import { randomUUID } from 'crypto'

type Row = Record<string, any>
const nowIso = () => new Date().toISOString()

// FK: tabla → { tablaRelacionada: columna FK }
const REL: Record<string, Record<string, string>> = {
  visitas: { usuarios: 'usuario_id', compitas: 'compita_id' },
  solicitudes: { usuarios: 'cliente_id', compitas: 'compita_id' },
  usuarios: { compitas: 'compita_id' },
  mensajes: { visitas: 'visit_id' },
  pagos_plan: { usuarios: 'usuario_id' },
}
const REL_INVERSA: Record<string, Record<string, string>> = {}

const DEFAULTS: Record<string, () => Row> = {
  compitas: () => ({ id: randomUUID(), estado: 'activo', verificado: false, visitas_realizadas: 0, total_ratings: 0, rating_promedio: null, telegram_chat_id: null, email: null, foto_url: null, youtube_url: null, servicios: [], horarios_disponibles: [], created_at: nowIso() }),
  usuarios: () => ({ plan: null, plan_contratado: null, plan_inicio: null, compita_id: null, familiar_nombre: null, familiar_edad: null, familiar_condicion: null, familiar_notas: null, zona: null, created_at: nowIso() }),
  visitas: () => ({ id: randomUUID(), estado: 'programada', fecha_programada: null, hora_inicio_programada: null, hora_fin_programada: null, inicio: null, fin: null, room_url: null, rating_cliente: null, created_at: nowIso() }),
  mensajes: () => ({ id: randomUUID(), tipo: 'texto', created_at: nowIso() }),
  solicitudes: () => ({ id: randomUUID(), estado: 'pendiente', token_respuesta: randomUUID(), recordatorio_enviado: false, seguimiento_enviado: false, seguimiento2_enviado: false, confirmacion_llamada_enviada: false, confirmacion_cliente: null, confirmacion_compita: null, reagendado_slots: [], slots_propuestos: [], slot_confirmado: null, room_url: null, respondido_at: null, sobre_cliente: null, franja_horaria: null, created_at: nowIso() }),
  reportes_visita: () => ({ id: randomUUID(), created_at: nowIso(), resumen_ia: null }),
  telegram_estados: () => ({ registro_pendiente: false, pendiente_accion: null, pendiente_expira: null, updated_at: nowIso() }),
  compita_edit_tokens: () => ({ id: randomUUID(), usado: false, created_at: nowIso() }),
  onboarding_tokens: () => ({ id: randomUUID(), usado: false, created_at: nowIso() }),
  action_tokens: () => ({ id: randomUUID(), usado: false, created_at: nowIso() }),
  pagos_plan: () => ({ id: randomUUID(), estado: 'activo', horas: null, referencia: null, created_at: nowIso() }),
  admin_flags: () => ({ id: randomUUID(), resuelto: false, created_at: nowIso() }),
}

const PK: Record<string, string> = { telegram_estados: 'chat_id' }

function dupError(msg: string) { return { code: '23505', message: `duplicate key value violates unique constraint "${msg}"` } }

export const OTPS = new Map<string, { id: string; email: string; usado: boolean }>()

export class FakeDB {
  tables: Record<string, Row[]> = {}
  /** Inyección de fallos: { 'visitas:update': 1 } hace fallar las próximas N operaciones. */
  fail: Record<string, number> = {}
  constructor() { this.reset() }
  reset() {
    this.tables = {}
    for (const t of Object.keys(DEFAULTS)) this.tables[t] = []
    this.fail = {}
  }
  rows(t: string): Row[] { return this.tables[t] }
  seed(t: string, row: Row): Row {
    const r = { ...DEFAULTS[t](), ...row }
    this.tables[t].push(r)
    return r
  }
  shouldFail(t: string, op: string) {
    const k = `${t}:${op}`
    if (this.fail[k] > 0) { this.fail[k]--; return true }
    return false
  }
  checkUnique(t: string, row: Row, ignoreRow?: Row): any | null {
    const others = this.tables[t].filter((r) => r !== ignoreRow)
    if (PK[t] && others.some((r) => r[PK[t]] === row[PK[t]])) return dupError(`${t}_pkey`)
    if (t !== 'telegram_estados' && row.id && others.some((r) => r.id === row.id)) return dupError(`${t}_pkey`)
    if (t === 'compitas' && row.telegram_chat_id && others.some((r) => r.telegram_chat_id === row.telegram_chat_id)) return dupError('compitas_telegram_chat_id_key')
    if (t === 'usuarios' && row.email && others.some((r) => r.email === row.email)) return dupError('usuarios_email_key')
    // Índices de la migración 20261009
    if (t === 'visitas' && row.estado === 'en_curso' && others.some((r) => r.compita_id === row.compita_id && r.estado === 'en_curso')) return dupError('visitas_una_en_curso_por_compita')
    if (t === 'visitas' && ['pre_visita', 'programada', 'en_curso'].includes(row.estado) && others.some((r) => r.usuario_id === row.usuario_id && ['pre_visita', 'programada', 'en_curso'].includes(r.estado))) return dupError('visitas_una_activa_por_cliente')
    if (t === 'solicitudes' && row.estado === 'pendiente' && others.some((r) => r.cliente_id === row.cliente_id && r.compita_id === row.compita_id && r.estado === 'pendiente')) return dupError('solicitudes_una_pendiente_por_par')
    if (t === 'reportes_visita' && others.some((r) => r.visita_id === row.visita_id)) return dupError('reportes_visita_unico_por_visita')
    for (const col of ['token']) if ((t === 'compita_edit_tokens' || t === 'onboarding_tokens' || t === 'action_tokens') && others.some((r) => r[col] === row[col])) return dupError(`${t}_token_key`)
    return null
  }
}

// ── Parser del string de select ────────────────────────────────────────────────
type SelItem = { kind: 'col'; name: string } | { kind: 'star' } | { kind: 'embed'; key: string; table: string; sub: string }
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}
function parseSelect(sel: string): SelItem[] {
  return splitTop(sel).map((part) => {
    if (part === '*') return { kind: 'star' } as SelItem
    const m = part.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\s*\(([\s\S]*)\)$/)
    if (m) return { kind: 'embed', key: m[1] ?? m[2], table: m[2], sub: m[3] } as SelItem
    return { kind: 'col', name: part } as SelItem
  })
}

function like(value: any, pattern: string, ci = false): boolean {
  if (value === null || value === undefined) return false
  let v = String(value), p = pattern
  if (ci) { v = v.toLowerCase(); p = p.toLowerCase() }
  // soporta % y escapes \% \_ (escLike)
  let re = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '\\' && i + 1 < p.length) { re += p[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
    if (c === '%' || c === '*') re += '.*'
    else if (c === '_') re += '.'
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`, 's').test(v)
}

function cmp(a: any, b: any): number { return a < b ? -1 : a > b ? 1 : 0 }

function parseVal(op: string, raw: string): any {
  if (op === 'is') return raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  return raw
}

function predicate(col: string, op: string, val: any): (r: Row) => boolean {
  const g = (r: Row) => r[col]
  switch (op) {
    case 'eq': return (r) => g(r) !== null && g(r) !== undefined && String(g(r)) === String(val)
    case 'neq': return (r) => g(r) !== null && g(r) !== undefined && String(g(r)) !== String(val) // SQL: NULL <> x es NULL → excluido
    case 'is': return (r) => (val === null ? g(r) === null || g(r) === undefined : g(r) === val)
    case 'gt': return (r) => g(r) != null && cmp(g(r), val) > 0
    case 'gte': return (r) => g(r) != null && cmp(g(r), val) >= 0
    case 'lt': return (r) => g(r) != null && cmp(g(r), val) < 0
    case 'lte': return (r) => g(r) != null && cmp(g(r), val) <= 0
    case 'like': return (r) => like(g(r), String(val))
    case 'ilike': return (r) => like(g(r), String(val), true)
    case 'in': return (r) => (val as any[]).map(String).includes(String(g(r)))
    default: throw new Error(`Operador no soportado en el fake: ${op}`)
  }
}

class Query {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private preds: Array<(r: Row) => boolean> = []
  private payload: any
  private selStr = '*'
  private wantReturn = false
  private count: 'exact' | null = null
  private head = false
  private orders: Array<{ col: string; asc: boolean }> = []
  private lim: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private onConflict?: string

  constructor(private db: FakeDB, private table: string) {}

  select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this.op === 'select') this.selStr = cols
    else { this.wantReturn = true; this.selStr = cols }
    if (opts?.count) this.count = opts.count
    if (opts?.head) this.head = true
    return this
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.preds.push(predicate(c, 'eq', v)); return this }
  neq(c: string, v: any) { this.preds.push(predicate(c, 'neq', v)); return this }
  gt(c: string, v: any) { this.preds.push(predicate(c, 'gt', v)); return this }
  gte(c: string, v: any) { this.preds.push(predicate(c, 'gte', v)); return this }
  lt(c: string, v: any) { this.preds.push(predicate(c, 'lt', v)); return this }
  lte(c: string, v: any) { this.preds.push(predicate(c, 'lte', v)); return this }
  like(c: string, v: string) { this.preds.push(predicate(c, 'like', v)); return this }
  ilike(c: string, v: string) { this.preds.push(predicate(c, 'ilike', v)); return this }
  in(c: string, v: any[]) { this.preds.push(predicate(c, 'in', v)); return this }
  is(c: string, v: any) { this.preds.push(predicate(c, 'is', v)); return this }
  not(c: string, op: string, v: any) {
    if (op === 'in') {
      const list = String(v).replace(/[()"]/g, '').split(',')
      const p = predicate(c, 'in', list); this.preds.push((r) => !p(r)); return this
    }
    const p = predicate(c, op, v)
    // `not.is.null` = IS NOT NULL ; para el resto, negación simple (SQL NULL ya excluido en gt/lt…)
    this.preds.push(op === 'is' ? (r) => !p(r) : (r) => r[c] != null && !p(r))
    return this
  }
  or(expr: string) {
    const conds = splitTop(expr).map((c) => {
      const m = c.match(/^(\w+)\.(\w+)\.(.*)$/)
      if (!m) throw new Error(`or() no soportado: ${c}`)
      return predicate(m[1], m[2], parseVal(m[2], m[3]))
    })
    this.preds.push((r) => conds.some((p) => p(r)))
    return this
  }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false }); return this }
  limit(n: number) { this.lim = n; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej) }

  // ── ejecución ──
  private project(row: Row, sel: string): Row {
    const items = parseSelect(sel)
    if (items.length === 1 && items[0].kind === 'star') return { ...row }
    const out: Row = {}
    for (const it of items) {
      if (it.kind === 'star') Object.assign(out, row)
      else if (it.kind === 'col') out[it.name] = row[it.name]
      else out[it.key] = this.embed(row, it.table, it.sub)
    }
    return out
  }
  private embed(row: Row, table: string, sub: string): any {
    const fk = REL[this.table]?.[table]
    if (fk) {
      const target = this.db.rows(table).find((r) => (table === 'usuarios' ? r.id : r.id) === row[fk])
      if (!target) return null
      const q = new Query(this.db, table)
      return q.project(target, sub)
    }
    throw new Error(`Relación no definida en el fake: ${this.table} → ${table}`)
  }
  private finish(rows: Row[]): any {
    let out = rows
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => {
        const x = a[o.col], y = b[o.col]
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        return o.asc ? cmp(x, y) : cmp(y, x)
      })
    }
    if (this.lim !== null) out = out.slice(0, this.lim)
    const count = this.count ? rows.length : null
    if (this.head) return { data: null, error: null, count }
    const proj = out.map((r) => this.project(r, this.selStr))
    if (this.mode === 'single') {
      if (proj.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, count }
      return { data: proj[0], error: null, count }
    }
    if (this.mode === 'maybe') {
      if (proj.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' }, count }
      return { data: proj[0] ?? null, error: null, count }
    }
    return { data: proj, error: null, count }
  }
  private run(): any {
    const t = this.table
    if (!this.db.tables[t]) return { data: null, error: { code: '42P01', message: `relation "${t}" does not exist` } }
    if (this.db.shouldFail(t, this.op)) return { data: null, error: { code: 'XX000', message: `fallo inyectado en ${t}:${this.op}` } }
    const matches = () => this.db.tables[t].filter((r) => this.preds.every((p) => p(r)))

    if (this.op === 'select') return this.finish(matches())

    if (this.op === 'insert' || this.op === 'upsert') {
      const items: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      const created: Row[] = []
      for (const item of items) {
        const conflictCol = this.onConflict ?? PK[t] ?? 'id'
        if (this.op === 'upsert') {
          const existing = this.db.tables[t].find((r) => r[conflictCol] !== undefined && r[conflictCol] === item[conflictCol])
          if (existing) { Object.assign(existing, item); created.push(existing); continue }
        }
        const row = { ...DEFAULTS[t](), ...item }
        const err = this.db.checkUnique(t, row)
        if (err) return { data: null, error: err }
        this.db.tables[t].push(row)
        created.push(row)
      }
      return this.wantReturn ? this.finish(created) : { data: null, error: null }
    }

    if (this.op === 'update') {
      const rows = matches()
      for (const r of rows) {
        const next = { ...r, ...this.payload }
        const err = this.db.checkUnique(t, next, r)
        if (err) return { data: null, error: err }
      }
      for (const r of rows) Object.assign(r, this.payload)
      return this.wantReturn ? this.finish(rows) : { data: null, error: null }
    }

    // delete
    const rows = matches()
    this.db.tables[t] = this.db.tables[t].filter((r) => !rows.includes(r))
    return this.wantReturn ? this.finish(rows) : { data: null, error: null }
  }
}

export function makeClient(db: FakeDB, user: () => { id: string; email: string } | null) {
  return {
    from: (t: string) => new Query(db, t),
    auth: {
      getUser: async () => ({ data: { user: user() }, error: null }),
      getSession: async () => ({ data: { session: user() ? { user: user() } : null } }),
      signOut: async () => ({ error: null }),
      admin: {
        inviteUserByEmail: async (email: string, opts: any) => {
          const id = randomUUID()
          return { data: { user: { id, email } }, error: null }
        },
        generateLink: async ({ type, email }: { type: string; email: string; options?: any }) => {
          const existente = db.tables.usuarios.find((u) => u.email === email)
          if (type === 'invite' && existente) return { data: null, error: { status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' } }
          const id = existente?.id ?? randomUUID()
          const hashed = `hash-${type}-${id}-${OTPS.size}`
          OTPS.set(hashed, { id, email, usado: false })
          return { data: { user: { id, email }, properties: { hashed_token: hashed, action_link: 'x', verification_type: type } }, error: null }
        },
        updateUserById: async (id: string, attrs: any) => { (db as any).bans = (db as any).bans ?? {}; (db as any).bans[id] = attrs.ban_duration; return { data: { user: { id } }, error: null } },
        deleteUser: async (id: string) => {
          db.tables.usuarios = db.tables.usuarios.filter((u) => u.id !== id)
          return { error: null }
        },
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  }
}
