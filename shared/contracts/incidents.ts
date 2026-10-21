import type {
  BlockedArea,
} from './geography'

import type {
  PedestrianImpact,
} from './pedestrian'

import type {
  SurfaceImpact,
} from './surfaces'

export type {
  BlockedArea,
} from './geography'

export type IncidentType =
  | 'temporary_obstacle'
  | 'temporary_closure'
  | 'roadworks'
  | 'standing_water'
  | 'crowd'
  | 'obstructing_vehicle'
  | 'scheduled_event'
  | 'pothole'
  | 'uneven_surface'

export type IncidentEffect =
  | 'informational'
  | 'caution'
  | 'blockage'

export type IncidentSource =
  | 'simulation'
  | 'manual'
  | 'ai_generated'

export type IncidentStatus =
  | 'scheduled'
  | 'active'
  | 'finished'

// Datos comunes sin fechas.
// También los reutiliza el registro interno del backend.
export type IncidentData = {
  id: string
  simulationId: string

  // Conservamos blockage para los registros y pruebas anteriores.
  type: IncidentType | 'blockage'

  source: IncidentSource
  description: string
  effect: IncidentEffect
  reporterName: string | null
  blockedArea: BlockedArea
  pedestrianImpact?: PedestrianImpact | null
}

// DTO es el objeto que viaja por HTTP.
//
// Las fechas son texto porque JSON no transporta objetos Date.
// Las validaciones de los datos recibidos siguen siendo necesarias.
export type IncidentDTO = IncidentData & {
  surfaceImpact?: SurfaceImpact | null
  createdAt: string
  startsAt: string
  expiresAt: string
}

export type ListedIncidentDTO = IncidentDTO & {
  status: IncidentStatus
}