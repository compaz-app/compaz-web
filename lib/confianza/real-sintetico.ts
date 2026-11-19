// Fuente SINTÉTICA para probar la vista «Operación real» sin el CMC (solo en pruebas y en un deploy preview sin la API configurada).
// Personas inventadas con códigos COM-9xxx (el CMC real va por COM-1xxx). Nunca se usa en producción: lo impide fuenteSinteticaPermitida.
import type { FichaCmc, FilaCmc } from '@/lib/cmc-api'

export const fuenteSinteticaPermitida = (contexto = process.env.COMPAZ_CONTEXTO_DESPLIEGUE ?? '') => contexto === 'deploy-preview'

const NOMBRES = ['Ana Ficticia', 'Bruno Inventado', 'Carla Ejemplar', 'Diego Simulado', 'Elena Modelo', 'Fabián Muestra', 'Gloria Sintética', 'Hugo Prototipo']
const ZONAS = ['Chacao, Caracas', 'Baruta, Miranda', 'El Hatillo, Miranda', 'Sucre, Miranda', 'Libertador, Caracas']
const ETAPAS = ['Registrado', 'Registrado', 'Registrado', 'Preseleccionado', 'Preseleccionado', 'Entrevistado', 'En verificación', 'Habilitado', 'Descartado', '']

export function listaSintetica(n = 120): FilaCmc[] {
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
  // Misma forma que la API real (docs/cmc/api-lectura/ApiPanel.gs, cmcApi_ficha_), con datos inventados.
  return {
    ficha: {
      ficha: { 'ID Compita': id, Nombre: f.nombre, 'Ubicación declarada': f.zona, 'Etapa de selección': f.etapa, 'Estado preentrevista': f.preentrevista, 'Estado operativo': f.estadoOperativo },
      ops: { estadoOperativo: f.estadoOperativo || '', aceptaNuevos: f.aceptaNuevos || '', motivo: '' },
      elegibilidad: {
        ok: true, id, etapaSeleccion: f.etapa, elegible: f.etapa === 'Habilitado', razones: f.etapa === 'Habilitado' ? [] : ['Dato ficticio de prueba'], puedeHabilitar: false,
        pendientesHabilitacion: ['Identidad sin verificación Verificada + Vigente', 'Ninguna Referencia Verificada + Vigente', 'Onboarding más reciente no es «Completado»'],
        requisitos: [
          { clave: 'identidad', etiqueta: 'Identidad verificada', estado: 'Pendiente', detalle: 'Identidad sin verificación Verificada + Vigente' },
          { clave: 'referencia', etiqueta: 'Referencia verificada', estado: 'Pendiente', detalle: 'Ninguna Referencia Verificada + Vigente' },
          { clave: 'onboarding', etiqueta: 'Onboarding completado', estado: 'Pendiente', detalle: 'Sin registros' },
          { clave: 'alertas', etiqueta: 'Sin alertas que bloqueen', estado: f.alertasBloquean ? 'Bloqueado' : 'Cumplido', detalle: '' },
          { clave: 'operador', etiqueta: 'Operador autorizado', estado: 'Bloqueado', detalle: 'Depende de quién habilita' },
        ],
      },
      alertas: f.alertasAbiertas ? [{ idAlerta: 'ALT-S01', tipo: 'Inconsistencia', severidad: 'Media', estado: 'Abierta', bloqueaMatching: 'Sí', motivo: 'Dato ficticio de prueba' }] : [],
      onboarding: { historial: [], masReciente: null },
    },
    pestanas: {
      preentrevista: { ok: true, respuestas: [{ pregunta: '¿Por qué te interesa ser Compita?', respuesta: 'Respuesta ficticia de prueba.' }] },
      entrevista: { ok: false, error: 'No hay entrevistas registradas' },
      verificaciones: { ok: true, items: [] },
      historial: { ok: true, eventos: [{ fecha: f.registro, tipo: 'Alta', detalle: 'Registro ficticio' }] },
    },
  }
}
