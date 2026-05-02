'use client'

import { Loading } from '@/components/ui/loading'

export default function AppLoading() {
  return (
    <Loading fullscreen message="Cargando la aplicación..." subtitle="Preparando tu espacio de trabajo" />
  )
}

