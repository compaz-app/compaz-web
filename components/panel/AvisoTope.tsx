import Aviso from '@/components/ui/base/Aviso'

/**
 * Las listas del panel cargan un máximo de filas (lo más reciente primero). Si se llegó al máximo, hay más de lo que se ve y los conteos, la búsqueda
 * y los filtros solo valen para lo cargado: se dice (S-10), en vez de mostrar números que parecen completos y no lo son.
 */
export default function AvisoTope({ cargadas, tope, que }: { cargadas: number; tope: number; que: string }) {
  if (cargadas < tope) return null
  return (
    <Aviso tamano="compacto" tono="advertencia">
      Se muestran solo {que} más recientes ({tope.toLocaleString('es-VE')}). Hay más de las que caben aquí: los conteos, la búsqueda y los filtros valen solo para estas.
    </Aviso>
  )
}
