// La marca de una propuesta de cita (pura). Va en los botones del compita y en la clave de la tarea de «cita sin confirmar», para que un botón o una tarea viejos
// nunca se confundan con una propuesta nueva.
export const versionCita = (propuestaEn: string | null | undefined) => (propuestaEn ? Math.floor(new Date(propuestaEn).getTime() / 1000).toString(36).slice(-6) : '')
