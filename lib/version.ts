// Versión del sistema (una sola fuente). Se muestra en el panel y se sube cuando entra algo relevante; el historial está en docs/versiones.md.
// Formato: mayor.menor.parche[-etapa]. Mayor: cambio grande o lanzamiento; menor: función nueva; parche: arreglo. La etapa "beta" sale cuando el
// sistema corre una o dos semanas con uso real sin sorpresas. tests/85-version.test.ts exige que package.json y el historial coincidan con esta.
export const VERSION = '1.0.0-beta.1'
