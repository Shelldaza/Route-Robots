import type {
  PedestrianImpact,
  PedestrianSegment,
} from '../../../shared/contracts/pedestrian'

// Estos validadores no dependen del mapa.
// Se pueden usar desde la API y desde las pruebas.
export function isPedestrianImpact(
  value: unknown,
): value is PedestrianImpact {
  if (!value || typeof value !== 'object') return false

  const item = value as Record<string, unknown>

  return (
    typeof item.networkVersion === 'string'
    && (
      item.scope === 'segment'
      || item.scope === 'street_section'
    )
    && Array.isArray(item.segmentIds)
    && item.segmentIds.length > 0
    && item.segmentIds.every(
      (id) => typeof id === 'string',
    )
    && Array.isArray(item.segments)
    && item.segments.length === item.segmentIds.length
    && item.segments.every(isPedestrianSegment)
    && item.segments.every((segment) =>
      (item.segmentIds as string[]).includes(segment.id)
    )
  )
}

export function isPedestrianSegment(
  value: unknown,
): value is PedestrianSegment {
  if (!value || typeof value !== 'object') return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === 'string'
    && typeof item.wayId === 'number'
    && typeof item.from === 'string'
    && typeof item.to === 'string'
    && typeof item.name === 'string'
    && ['sidewalk', 'crossing', 'path'].includes(
      String(item.kind),
    )
    && Array.isArray(item.coordinates)
    && item.coordinates.length >= 2
    && item.coordinates.every((point) =>
      Array.isArray(point)
      && point.length === 2
      && typeof point[0] === 'number'
      && Number.isFinite(point[0])
      && Math.abs(point[0]) <= 180
      && typeof point[1] === 'number'
      && Number.isFinite(point[1])
      && Math.abs(point[1]) <= 90
    )
  )
}