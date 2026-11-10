'use client'
import Link from 'next/link'
import { useUrlState } from '../useUrlState'
import InfoBoton from '../InfoBoton'

// Eliminar mi cuenta (derecho del cliente a borrar sus datos). Se desactiva hoy y se borra a los 7 días; el cliente puede reactivarla entrando antes.
// El saldo no se reembolsa solo: las visitas de cada pago ya vencen a los 60 días y el reembolso se trata con el equipo.
export default function CuentaEliminar({ momento, visitasQuedan }: { momento: 'sin_pago' | 'revision' | 'primera' | 'recurrente'; visitasQuedan: string }) {
  const [paso, setPaso] = useUrlState('cuenta', '')
  const tienePlan = momento === 'primera' || momento === 'recurrente'
  const lista = 'grid gap-2 text-base'
  const fila = (txt: string) => <li className="flex gap-2"><span aria-hidden className="font-extrabold text-green-700">✓</span><span>{txt}</span></li>

  if (paso === '') {
    return (
      <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
        <h2 className="text-lg font-extrabold">Mi cuenta y mis datos</h2>
        <p className="mt-1 text-base text-[var(--text-mid)]">Puedes eliminar tu cuenta cuando quieras. Es tu derecho y no necesitas escribirnos.</p>
        <div className="mt-3 flex items-center gap-1">
          <button onClick={() => setPaso('eliminar')} className="min-h-12 flex-1 rounded-2xl border-2 border-[#991B1B] bg-white text-base font-extrabold text-[#991B1B]">Eliminar mi cuenta</button>
          <InfoBoton que="Eliminar mi cuenta" texto="Abre una pantalla que te explica qué se borra y qué se conserva. Todavía no se elimina nada: primero tienes que confirmar desde tu correo." />
        </div>
      </section>
    )
  }

  if (paso === 'eliminar') {
    return (
      <section className="mt-6 rounded-3xl border-2 border-[#991B1B] bg-white p-5">
        <h2 className="text-xl font-extrabold">Antes de eliminar tu cuenta</h2>
        <h3 className="mt-4 font-extrabold">Qué se borra</h3>
        <ul className={`mt-2 ${lista}`}>{fila('Tu nombre y tus datos de contacto')}{fila('La ficha de tu mamá, su dirección y sus notas')}{fila('Las fotos y los mensajes con tu compita')}</ul>
        <h3 className="mt-4 font-extrabold">Qué conservamos, sin tu nombre</h3>
        <p className="mt-1 text-base text-[var(--text-mid)]">Los registros de pagos y de visitas, sin ningún dato que te identifique. Los necesitamos por contabilidad y por la seguridad de los compitas y de otras familias.</p>
        <h3 className="mt-4 font-extrabold">Tu saldo</h3>
        {tienePlan ? (
          <>
            <p className="mt-1 text-base text-[var(--text-mid)]">Te quedan <b>{visitasQuedan} visitas</b>. Si eliminas la cuenta se pierden. De todas formas, las visitas de cada pago vencen a los 60 días (las tuyas, el 18 de diciembre). ¿Prefieres usarlas? Agéndalas antes de eliminar.</p>
            <div className="mt-2 flex items-center gap-1">
              <Link href="/prototipo/cliente?estado=agendar" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Agendar una visita</Link>
              <InfoBoton que="Agendar una visita" texto="Te lleva a elegir una fecha con tu compita para aprovechar tus visitas antes de eliminar la cuenta. No cambia nada de tu cuenta." />
            </div>
            <p className="mt-2 text-sm text-[var(--text-light)]">Sobre reembolsos: aplican ciertas condiciones. Escríbenos a hola@micompaz.com y lo vemos contigo.</p>
            <h3 className="mt-4 font-extrabold">Tus visitas programadas</h3>
            <p className="mt-1 text-base text-[var(--text-mid)]">Se cancelan sin costo. A María le avisamos sin darle detalles.</p>
          </>
        ) : <p className="mt-1 text-base text-[var(--text-mid)]">No tienes plan ni visitas pendientes: no pierdes nada.</p>}
        <h3 className="mt-4 font-extrabold">Cuándo se borra</h3>
        <p className="mt-1 text-base text-[var(--text-mid)]">Tu cuenta queda desactivada hoy y se borra de forma definitiva en 7 días (el 17 de noviembre). Si entras con tu correo antes de esa fecha, la reactivas y no se pierde nada.</p>
        <div className="mt-4 grid gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setPaso('enviado')} className="min-h-14 flex-1 rounded-2xl bg-[#991B1B] text-base font-extrabold text-white">Enviar enlace de confirmación a mi correo</button>
            <InfoBoton que="Enviar enlace de confirmación" texto="Te mandamos un enlace a tu correo. Tu cuenta no se desactiva hasta que lo toques, para evitar borrados por error o por alguien más." />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPaso('')} className="min-h-12 flex-1 rounded-2xl border border-[var(--border-muted)] bg-white font-bold text-[var(--text-mid)]">No, mantener mi cuenta</button>
            <InfoBoton que="Mantener mi cuenta" texto="Cierra esta pantalla sin hacer ningún cambio. Tu cuenta, tus visitas y tus datos siguen igual." />
          </div>
        </div>
      </section>
    )
  }

  if (paso === 'enviado') {
    return (
      <section className="mt-6 rounded-3xl border-2 border-[var(--purple)] bg-white p-5">
        <div aria-hidden className="text-3xl">📩</div>
        <h2 className="mt-1 text-xl font-extrabold">Revisa tu correo</h2>
        <p className="mt-1 text-base text-[var(--text-mid)]">Te enviamos un enlace a c***@mail.com. Tócalo para confirmar. Vence en 1 hora y hasta entonces tu cuenta sigue igual.</p>
        <div className="mt-4 grid gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setPaso('desactivada')} className="min-h-12 flex-1 rounded-2xl border-2 border-dashed border-[var(--purple)] font-extrabold text-[var(--purple)]">Simulación: toqué el enlace del correo</button>
            <InfoBoton que="Simulación del enlace" texto="Solo en el prototipo: representa que tocaste el enlace del correo. En el sistema real, ese toque desactiva la cuenta." />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPaso('')} className="min-h-12 flex-1 rounded-2xl border border-[var(--border-muted)] bg-white font-bold text-[var(--text-mid)]">Ya no quiero eliminarla</button>
            <InfoBoton que="Ya no quiero eliminarla" texto="Cancela el proceso. El enlace del correo deja de servir y tu cuenta sigue igual." />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-3xl border-2 border-[#991B1B] bg-white p-5">
      <div aria-hidden className="text-3xl">🗑️</div>
      <h2 className="mt-1 text-xl font-extrabold">Tu cuenta está desactivada</h2>
      <p className="mt-1 text-base text-[var(--text-mid)]">Se borra de forma definitiva el 17 de noviembre. Te enviamos un correo para confirmarlo. Si cambias de opinión antes de esa fecha, puedes reactivarla.</p>
      <div className="mt-3 flex items-center gap-1">
        <button onClick={() => setPaso('')} className="min-h-14 flex-1 rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Reactivar mi cuenta</button>
        <InfoBoton que="Reactivar mi cuenta" texto="Cancela el borrado: tu cuenta, tus visitas y tus datos vuelven como estaban. Las visitas programadas que se cancelaron las puedes agendar de nuevo." />
      </div>
    </section>
  )
}
