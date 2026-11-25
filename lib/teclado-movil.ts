// ¿Está abierto el teclado del teléfono? Cuando abre, la zona VISIBLE (visualViewport) se achica pero la ventana (innerHeight) casi no cambia en iPhone. Función pura.
// 120 px deja afuera lo que se mueve al esconderse la barra del navegador (unos 50 a 100 px) y entra solo con el teclado (más de 200 px).
export const UMBRAL_TECLADO_PX = 120
export const tecladoAbierto = (altoVentana: number, altoVisible: number): boolean => altoVentana - altoVisible > UMBRAL_TECLADO_PX
