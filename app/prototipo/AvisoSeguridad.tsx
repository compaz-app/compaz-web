// Advertencia antifraude que se repite en varios lugares (regla del usuario, 2026-11-04).
// Compaz nunca pide datos, claves, códigos, depósitos ni transferencias por teléfono o mensaje.
export const TEXTO_CLIENTE = 'Compaz nunca te pedirá por teléfono, mensaje o llamada tus datos personales, claves, códigos, depósitos ni transferencias. Los pagos se hacen solo con los datos que ves aquí, en tu portal. Si alguien te los pide por otro medio, no respondas y avísanos.'
export const TEXTO_COMPITA = 'Compaz nunca te pedirá por teléfono o mensaje dinero, depósitos, transferencias ni claves, y nunca te da el contacto del cliente. Si alguien te los pide en nombre de Compaz, no respondas y avísanos aquí.'

export default function AvisoSeguridad({ para = 'cliente', fuerte = false }: { para?: 'cliente' | 'compita'; fuerte?: boolean }) {
  return (
    <div role="note" className={`mt-5 flex gap-3 rounded-2xl p-4 text-sm leading-relaxed ${fuerte ? 'border-2 border-[#D93A3A] bg-[#FEF2F2] text-[#991B1B]' : 'border border-[#F5B800] bg-[#FFFBEB] text-[#7a5b00]'}`}>
      <span aria-hidden className="text-xl">🛡️</span>
      <p><b>Cuidado con los fraudes.</b> {para === 'cliente' ? TEXTO_CLIENTE : TEXTO_COMPITA}</p>
    </div>
  )
}
