export type Coordinate = [number, number]

export type BlockedArea = {
  south: number
  west: number
  north: number
  east: number
}

type RouteIncident = {
  effect: string
  blockedArea: BlockedArea
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
    routeIntersectsBlockedAreas(coordinates, [incident.blockedArea]),
  )
}
