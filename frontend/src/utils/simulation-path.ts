import type { Coordinate } from '../../../shared/contracts/geography'
export type { Coordinate } from '../../../shared/contracts/geography'

export type SimulationPath = {
  coordinates: Coordinate[]
  cumulativeMeters: number[]
  lengthMeters: number
}

function distanceMeters(
  start: Coordinate,
  end: Coordinate,
): number {
  const radians = Math.PI / 180
  const startLat = start[1] * radians
  const endLat = end[1] * radians
  const deltaLat = (end[1] - start[1]) * radians
  const deltaLng = (end[0] - start[0]) * radians

  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLng / 2) ** 2

  return (
    6371000 *
    2 *
    Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))))
  )
}

export function buildPath(
  coordinates: Coordinate[],
): SimulationPath {
  if (coordinates.length < 2) {
    throw new Error('El recorrido necesita al menos dos coordenadas.')
  }

  const cumulativeMeters = [0]
  let lengthMeters = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]

    if (!previous || !current) continue

    lengthMeters += distanceMeters(previous, current)
    cumulativeMeters.push(lengthMeters)
  }

  return {
    coordinates,
    cumulativeMeters,
    lengthMeters,
  }
}

export function samplePath(
  path: SimulationPath,
  progress: number,
): {
  position: Coordinate
  remainingCoordinates: Coordinate[]
} {
  const first = path.coordinates[0]
  const last = path.coordinates[path.coordinates.length - 1]

  if (!first || !last) {
    throw new Error('El recorrido no tiene coordenadas.')
  }

  const fraction = Math.min(1, Math.max(0, progress))

  if (fraction >= 1 || path.lengthMeters === 0) {
    return {
      position: last,
      remainingCoordinates: [last, last],
    }
  }

  const target = fraction * path.lengthMeters

  for (let index = 1; index < path.coordinates.length; index += 1) {
    const start = path.coordinates[index - 1]
    const end = path.coordinates[index]
    const previousDistance = path.cumulativeMeters[index - 1]
    const currentDistance = path.cumulativeMeters[index]

    if (
      !start ||
      !end ||
      previousDistance === undefined ||
      currentDistance === undefined
    ) {
      continue
    }

    const segmentLength = currentDistance - previousDistance

    if (segmentLength <= 0 || currentDistance < target) continue

    const segmentProgress =
      (target - previousDistance) / segmentLength

    const position: Coordinate = [
      start[0] + (end[0] - start[0]) * segmentProgress,
      start[1] + (end[1] - start[1]) * segmentProgress,
    ]

    return {
      position,
      remainingCoordinates: [
        position,
        ...path.coordinates.slice(index),
      ],
    }
  }

  return {
    position: last,
    remainingCoordinates: [last, last],
  }
}