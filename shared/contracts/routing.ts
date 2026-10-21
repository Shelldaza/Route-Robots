// Respuestas JSON y estados de la evaluación.
// No dependen de React ni de Leaflet.

import type { Coordinate, GeographicPoint } from './geography'
export type { Coordinate, GeographicPoint } from './geography'

export type RouteResponse = {
  geometry: {
    type: 'LineString'
    coordinates: Coordinate[]
  }
  distanceMeters: number
  durationSeconds: number
  profile: string
  networkVersion?: string
}

export type ToolExecution = {
  name: string
  success: boolean
}

// El estado determina si debe existir una ruta.
// Una explicación de la IA no crea por sí sola una ruta.
export type ReplanningResult = {
  explanation: string
  incidentIds: string[]
  toolCalls: ToolExecution[]
} & (
  | {
    status: 'alternative_ready'
    route: RouteResponse
  }
  | {
    status: 'not_replanned'
    route: null
  }
)

export type ReplanningStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error'

export type ReplanningRequest = {
  simulationId: string
  origin: GeographicPoint
  destination: GeographicPoint
  scenarioTime: string
  networkVersion?: string
  preferredCoordinates?: Coordinate[]
}