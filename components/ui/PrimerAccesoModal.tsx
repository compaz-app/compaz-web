'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PrimerAccesoModal() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    telefono: '',
    familiar_nombre: '',
    familiar_edad: '',
    familiar_condicion: '',
    familiar_notas: '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.familiar_nombre.trim()) {
      setError('El nombre del familiar es obligatorio.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/usuario/familiar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: form.telefono,
          familiar_nombre: form.familiar_nombre,
          familiar_edad: form.familiar_edad ? Number(form.familiar_edad) : null,
          familiar_condicion: form.familiar_condicion,
          familiar_notas: form.familiar_notas,
        }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? 'No pudimos guardar. Inténtalo de nuevo.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,60,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '36px 32px', maxWidth: '520px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', marginTop: 'auto', marginBottom: 'auto' }}>
        <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '22px', color: '#1A0A3C', margin: '0 0 6px' }}>
          Antes de continuar
        </h2>
        <p style={{ color: '#6B5C90', fontSize: '14px', lineHeight: 1.6, margin: '0 0 28px' }}>
          Necesitamos algunos datos para que tu compita pueda prepararse. Tu teléfono solo lo veremos nosotros — la compita no lo recibirá.
        </p>

        <form onSubmit={guardar}>
          <Section title="Tus datos de contacto">
            <Field label="Tu teléfono / WhatsApp" hint="Solo Compaz lo verá, la compita no">
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                placeholder="+58 412 000 0000"
                style={inputStyle}
              />
            </Field>
          </Section>

          <Section title="Sobre tu familiar">
            <Field label="Nombre completo" required>
              <input
                type="text"
                value={form.familiar_nombre}
                onChange={(e) => set('familiar_nombre', e.target.value)}
                placeholder="Ej: María González"
                maxLength={120}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Edad">
              <input
                type="number"
                value={form.familiar_edad}
                onChange={(e) => set('familiar_edad', e.target.value)}
                placeholder="Ej: 78"
                min={1}
                max={120}
                style={{ ...inputStyle, width: '120px' }}
              />
            </Field>
            <Field label="Condición o diagnóstico">
              <input
                type="text"
                value={form.familiar_condicion}
                onChange={(e) => set('familiar_condicion', e.target.value)}
                placeholder="Ej: Alzheimer leve, movilidad reducida"
                maxLength={200}
                style={inputStyle}
              />
            </Field>
            <Field label="Notas adicionales" hint="Rutinas, preferencias, lo que la compita debería saber">
              <textarea
                value={form.familiar_notas}
                onChange={(e) => set('familiar_notas', e.target.value)}
                placeholder="Ej: Le gusta caminar en las mañanas, necesita ayuda para bañarse…"
                maxLength={800}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
          </Section>

          {error && (
            <p style={{ color: '#DC2626', fontSize: '13px', marginTop: '8px', marginBottom: '4px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{ marginTop: '24px', width: '100%', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '16px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}
          >
            {cargando ? 'Guardando…' : 'Continuar →'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#4A3B6B', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: '3px' }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: '#9B8AB8', marginLeft: '6px', fontSize: '12px' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '12px',
  border: '2px solid #E8E0D4',
  padding: '11px 14px',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  color: '#1A0A3C',
  outline: 'none',
  boxSizing: 'border-box',
  background: 'white',
}
