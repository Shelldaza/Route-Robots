import type { Coordinate, BlockedArea } from '../../../shared/contracts/geography'
export type { Coordinate, BlockedArea } from '../../../shared/contracts/geography'

type RouteIncident = {
  effect: string
  blockedArea: BlockedArea
  pedestrianImpact?: { segments: { coordinates: Coordinate[] }[] } | null
}

function segmentIntersectsArea(
  start: Coordinate,
  end: Coordinate,
  area: BlockedArea,
): boolean {
  const [startLng, startLat] = start
  const [endLng, endLat] = end
  const deltaLng = endLng - startLng
  const deltaLat = endLat - startLat
  let entry = 0
  let exit = 1

  // Mismo recorte de segmentos que usa el backend. Los extremos pueden
  // quedar fuera del rectángulo y aun así atravesarlo. El contacto con
  // un borde también cuenta como intersección para evitar rozar bloqueos.
  // Esta aproximación en longitud/latitud se limita al sandbox urbano.
  const boundaries: [number, number][] = [
    [-deltaLng, startLng - area.west],
    [deltaLng, area.east - startLng],
    [-deltaLat, startLat - area.south],
    [deltaLat, area.north - startLat],
  ]

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return false
      continue
    }

    const fraction = distance / direction
    if (direction < 0) {
      entry = Math.max(entry, fraction)
    } else {
      exit = Math.min(exit, fraction)
    }

    if (entry > exit) return false
  }

  return true
}

export function routeIntersectsBlockedAreas(
  coordinates: readonly Coordinate[],
  blockedAreas: readonly BlockedArea[],
): boolean {
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]
    const end = coordinates[index]
    if (!start || !end) continue

    for (const area of blockedAreas) {
      if (segmentIntersectsArea(start, end, area)) return true
    }
  }

  return false
}

export function getRouteBlockages<T extends RouteIncident>(
  coordinates: readonly Coordinate[],
  activeIncidents: readonly T[],
): T[] {
  // La vigencia se resuelve antes, usando el reloj del escenario.
  // Las precauciones permanecen visibles, pero no cortan el recorrido.
  return activeIncidents.filter((incident) =>
    incident.effect === 'blockage' &&
    (incident.pedestrianImpact
      ? routeOverlapsPedestrianSegments(coordinates, incident.pedestrianImpact.segments)
      : routeIntersectsBlockedAreas(coordinates, [incident.blockedArea])),
  )
}

// Solo cuenta la superposición longitudinal con el tramo, no tocar el nodo
// de una esquina. La posición muestreada puede estar en mitad de un segmento.
export function routeOverlapsPedestrianSegments(
  coordinates: readonly Coordinate[],
  segments: readonly { coordinates: Coordinate[] }[],
): boolean {
  for (let i = 1; i < coordinates.length; i += 1) {
    const start = coordinates[i - 1]!
    const end = coordinates[i]!
    const scaleX = 111320 * Math.cos(start[1] * Math.PI / 180)
    const dx = (end[0] - start[0]) * scaleX
    const dy = (end[1] - start[1]) * 111320
    const length = Math.hypot(dx, dy)
    if (length < 0.001) continue
    for (const segment of segments) {
      for (let j = 1; j < segment.coordinates.length; j += 1) {
        const a = segment.coordinates[j - 1]!
        const b = segment.coordinates[j]!
        const ax = (a[0] - start[0]) * scaleX
        const ay = (a[1] - start[1]) * 111320
        const bx = (b[0] - start[0]) * scaleX
        const by = (b[1] - start[1]) * 111320
        if (Math.abs(ax * dy - ay * dx) / length > 0.15 ||
          Math.abs(bx * dy - by * dx) / length > 0.15) continue
        const ta = (ax * dx + ay * dy) / length
        const tb = (bx * dx + by * dy) / length
        if (Math.min(length, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb)) > 0.02) return true
      }
    }
  }
  return false
}
