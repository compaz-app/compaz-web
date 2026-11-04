import Link from 'next/link'

const PANTALLAS = [
  { href: '/prototipo/ciclo', t: 'El ciclo encadenado: reglas y avisos', d: 'Las 8 reglas y, para cada paso: quién actúa, qué aviso recibe, con qué botón y a dónde llega. Es el mapa que evita que la gente se pierda.' },
  { href: '/prototipo/recorrido', t: 'Empieza aquí: recorrido de un cliente nuevo', d: 'Los 16 pasos del flujo completo, en orden. En cada paso ves lo que ve el cliente, lo que recibe el compita y lo que ve el admin.' },
  { href: '/prototipo/cliente/entrar', t: 'Entrar al portal (login)', d: 'Correo, enlace o código de 6 números, con cuenta atrás visible. Es lo primero que ve el cliente.' },
  { href: '/prototipo/cliente', t: 'Portal del cliente', d: 'Una línea de 5 pasos y una sola tarjeta con lo que toca ahora. Cambia de estado con el selector de arriba.' },
  { href: '/prototipo/compita', t: 'Telegram del compita', d: 'Maqueta del chat: un mensaje, una acción, botones dentro del mensaje, y "¿Qué me toca?".' },
  { href: '/prototipo/admin', t: 'Admin tipo CRM', d: 'Bandeja "Requiere atención", Seguimiento por etapas, Personas con ficha y línea de tiempo.' },
]

export default function Indice() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Prototipo del rediseño</h1>
      <p className="mt-2 text-[var(--text-mid)]">Empieza por el recorrido. Debajo están las pantallas sueltas, por si quieres verlas con calma.</p>
      <div className="mt-8 grid gap-4">
        {PANTALLAS.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-2xl border border-[var(--border-muted)] bg-white p-5 shadow-sm active:scale-[0.99]">
            <div className="text-lg font-bold">{p.t}</div>
            <div className="mt-1 text-[var(--text-mid)]">{p.d}</div>
            <div className="mt-3 font-bold text-[var(--orange-dark)]">Abrir ›</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
