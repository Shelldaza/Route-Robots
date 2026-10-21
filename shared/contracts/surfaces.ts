import type {
  Coordinate,
} from './geography'

// Conserva el nombre usado por los algoritmos de superficies.
export type Point = Coordinate

export type {
  Bounds,
} from './geography'

export type Area = {
  type: 'MultiPolygon'
  coordinates: Point[][][]
}

export type Box = {
  center: Point
  halfWidth: number
  halfLength: number
  angle: number
}

// Contratos JSON: las fechas cartográficas se transportan como texto.
export type WalkSurface = {
  id: number
  code: number
  capturedAt: string | null
  geometry: Area
}

export type SurfaceImpact = {
  geometry: Area
  collisionGeometry: Area
  surfaces: WalkSurface[]
  contextSurfaces?: WalkSurface[]
  segmentIds: string[]
  source: string
  retrievedAt: string
  box: Box
  unknown: boolean
}