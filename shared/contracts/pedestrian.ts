import type {
  Bounds,
  Coordinate,
} from './geography'

export type PedestrianSegment = {
  id: string
  wayId: number
  from: string
  to: string
  kind: 'sidewalk' | 'crossing' | 'path'
  name: string
  coordinates: Coordinate[]
}

// Puede contener solo los tramos cargados para la vista actual.
// No implica que estén descargados todos los tramos en el navegador.
export type PedestrianNetwork = {
  version: string
  name: string
  attribution: string
  source: string
  retrievedAt: string
  bounds: Bounds
  segments: PedestrianSegment[]
}

// La API informa además el total de tramos de la captura.
export type PedestrianNetworkResponse = PedestrianNetwork & {
  segmentCount: number
}

export type PedestrianSelection = {
  networkVersion: string
  scope: 'segment' | 'street_section'
  segmentIds: string[]
}

export type PedestrianImpact = PedestrianSelection & {
  segments: PedestrianSegment[]
}