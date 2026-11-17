/* eslint-disable */
// La política de privacidad dice dónde se guardan los datos de verdad (Supabase, no Airtable).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('/privacidad no menciona Airtable y nombra a Supabase como el proveedor de la base de datos', () => {
  const f = readFileSync('app/privacidad/page.tsx', 'utf8')
  assert.doesNotMatch(f, /airtable/i); assert.match(f, /se almacenan en Supabase/)
})
