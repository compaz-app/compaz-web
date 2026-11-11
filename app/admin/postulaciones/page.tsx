// /admin/postulaciones → Más, Postulaciones y origen del panel nuevo (los avisos de Telegram todavía pueden traer este enlace).
import { redirect } from 'next/navigation'

export default function PostulacionesPage() {
  redirect('/panel?sec=mas&mas=postulaciones')
}
