// Fuente SINTÉTICA para probar la vista «Operación real» sin el CMC (solo en pruebas y en un deploy preview sin la API configurada).
// Personas inventadas con códigos COM-9xxx (el CMC real va por COM-1xxx). Nunca se usa en producción: lo impide fuenteSinteticaPermitida.
import type { FichaCmc, FilaCmc } from '@/lib/cmc-api'

export const fuenteSinteticaPermitida = (contexto = process.env.COMPAZ_CONTEXTO_DESPLIEGUE ?? '') => contexto === 'deploy-preview'

const NOMBRES = ['Ana Ficticia', 'Bruno Inventado', 'Carla Ejemplar', 'Diego Simulado', 'Elena Modelo', 'Fabián Muestra', 'Gloria Sintética', 'Hugo Prototipo']
const ZONAS = ['Chacao, Caracas', 'Baruta, Miranda', 'El Hatillo, Miranda', 'Sucre, Miranda', 'Libertador, Caracas']
const ETAPAS = ['Registrado', 'Registrado', 'Registrado', 'Preseleccionado', 'Preseleccionado', 'Entrevistado', 'En verificación', 'Habilitado', 'Descartado', '']

export function listaSintetica(n = 48): FilaCmc[] {
  return Array.from({ length: n }, (_, i) => {
    const etapa = ETAPAS[i % ETAPAS.length]
    return {
      id: `COM-9${String(i + 1).padStart(3, '0')}`, nombre: `${NOMBRES[i % NOMBRES.length]} ${i + 1}`, zona: ZONAS[i % ZONAS.length],
      registro: new Date(Date.UTC(2026, 9, 1 + (i % 45))).toISOString(), etapa, estadoOperativo: etapa === 'Habilitado' ? 'Activo' : '', aceptaNuevos: etapa === 'Habilitado' ? 'Sí' : '',
      preentrevista: i % 3 === 0 ? 'Enviada' : 'Respondida', duplicadoDe: i === 13 ? 'COM-9002' : '', clasificacionDuplicado: i === 13 ? 'Duplicado confirmado' : '',
      alertasAbiertas: i === 6 ? 1 : 0, alertasBloquean: i === 6 ? 1 : 0,
    }
  })
}

export function fichaSintetica(id: string): FichaCmc | null {
  const f = listaSintetica().find((x) => x.id === id)
  if (!f) return null
  return {
    ficha: {
      ok: true, id,
      ficha: { id, nombre: f.nombre, zona: f.zona, etapaSeleccion: f.etapa || 'Sin etapa', estadoPreentrevista: f.preentrevista },
      elegibilidad: {
        ok: true, id, etapaSeleccion: f.etapa, puedeHabilitar: false, pendientesHabilitacion: 3,
        requisitos: [
          { clave: 'entrevista', etiqueta: 'Entrevista con decisión «Avanza a verificación»', estado: 'Cumple', detalle: 'Entrevista registrada' },
          { clave: 'identidad', etiqueta: 'Identidad verificada', estado: 'Pendiente', detalle: 'Sin verificación vigente' },
          { clave: 'referencia', etiqueta: 'Referencia verificada', estado: 'Pendiente', detalle: 'Sin verificación vigente' },
          { clave: 'onboarding', etiqueta: 'Onboarding completado', estado: 'Pendiente', detalle: 'Sin registro' },
        ],
      },
      alertas: f.alertasAbiertas ? [{ idAlerta: 'ALT-S01', tipo: 'Inconsistencia', severidad: 'Media', estado: 'Abierta', bloqueaMatching: 'Sí', motivo: 'Dato ficticio de prueba' }] : [],
      onboarding: { ok: true, masReciente: null, historial: [] },
      disponibilidad: { ok: true, declarada: 'Lunes a viernes, mañanas', pendienteConfirmar: true },
      cobertura: { ok: true, zonas: [f.zona] },
    },
    pestanas: {
      preentrevista: { ok: true, respuestas: [{ pregunta: '¿Por qué te interesa ser Compita?', respuesta: 'Respuesta ficticia de prueba.' }] },
      entrevista: { ok: true, entrevistas: [] },
      verificaciones: { ok: true, items: [] },
      historial: { ok: true, eventos: [{ fecha: f.registro, tipo: 'Alta', detalle: 'Registro ficticio' }] },
    },
  }
}
