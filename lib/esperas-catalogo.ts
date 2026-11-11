// La lista de TODAS las reglas de espera y límites del sistema, con su valor de hoy y por qué existen. La lee la pantalla "Límites del sistema" del panel,
// para que el equipo pueda responder "¿por qué no deja hacer esto otra vez?" sin tocar el código.
import { getAjustes } from '@/lib/ajustes'
import { CATALOGO, type ClaveEspera } from '@/lib/esperas'

export interface FilaLimite { clave: ClaveEspera; quien: 'compita' | 'cliente' | 'equipo'; limita: string; porQue: string; valor: string }

export async function catalogoEsperas(): Promise<FilaLimite[]> {
  const a = await getAjustes()
  const valores: Record<ClaveEspera, string> = {
    recordatorio_reciente: `Un mínimo de ${a.recordatorio_cliente_horas} horas entre recordatorios (editable en Ajustes)`,
    recordatorio_limite: `Máximo ${a.recordatorio_cliente_max} por paso (editable en Ajustes)`,
    pago_insistencia: `Una alerta urgente cada ${a.pago_insistencia_min} minutos (editable en Ajustes)`,
    solicitudes_dia: 'Máximo 5 solicitudes en 24 horas',
    solicitud_mismo_compita: 'Una por compita cada 24 horas',
    codigo_fallos: '5 intentos fallidos en 15 minutos',
    codigo_conexion: '30 intentos en 15 minutos por conexión',
    acceso_conexion: '10 enlaces por hora por conexión',
    acceso_correo: 'Un enlace por minuto y correo',
    reconexion_llamada: 'Una reconexión cada 2 minutos',
    ayuda_cliente: 'Un aviso por hora por cliente',
    chat_limite: '10 mensajes por hora y 50 por día por conexión',
    postulacion_conexion: '50 postulaciones por hora por conexión',
    postulacion_correo: 'Una por correo',
  }
  return (Object.keys(CATALOGO) as ClaveEspera[]).map((clave) => ({ clave, ...CATALOGO[clave], valor: valores[clave] }))
}
