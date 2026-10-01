'use client'

import dynamic from 'next/dynamic'

const MapaCobertura = dynamic(() => import('./MapaCobertura'), { ssr: false })

interface Props {
  onEstadoSelect?: (estado: string) => void
  onMunicipioSelect?: (estado: string, municipio: string) => void
  hideToggle?: boolean
  selectedEstado?: string
  selectedMunicipio?: string
}

export default function MapaCoberturaWrapper(props: Props) {
  return <MapaCobertura {...props} />
}
