// /admin/equipo → Más, Equipo y permisos del panel nuevo.
import { redirect } from 'next/navigation'

export default function EquipoPage() {
  redirect('/panel?sec=mas&mas=equipo')
}
