// /admin ya no es un panel: el panel del equipo vive en /panel. Se conserva esta dirección para los enlaces y marcadores viejos.
import { redirect } from 'next/navigation'

// Las pestañas del panel viejo que tienen su equivalente directo en el nuevo.
const DESTINO: Record<string, string> = { clientes: '/panel?sec=personas', compitas: '/panel?sec=personas', accesos: '/panel?sec=personas', visitas: '/panel?sec=visitas' }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(DESTINO[tab ?? ''] ?? '/panel')
}
