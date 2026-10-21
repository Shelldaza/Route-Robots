// Regla compartida para construir el origen y destino de una replanificación.
// Las coordenadas de la ruta usan el orden GeoJSON: [longitud, latitud].

import type { Coordinate as RoutePoint } from '../contracts/geography'
export type { Coordinate as RoutePoint } from '../contracts/geography'

function validPoint(
  value: unknown,
): value is RoutePoint {
  if (!Array.isArray(value) || value.length !== 2) {
    return false
  }

  const [lng, lat] = value

  return (
    typeof lng === 'number'
    && Number.isFinite(lng)
    && Math.abs(lng) <= 180
    && typeof lat === 'number'
    && Number.isFinite(lat)
    && Math.abs(lat) <= 90
  )
}

export function replanningEndpoints(
  routeCoordinates: readonly RoutePoint[],
  currentPosition: RoutePoint | null | undefined,
) {
  if (routeCoordinates.length < 2) {
    throw new Error(
      'No hay un recorrido válido para replanificar.',
    )
  }

  const first = routeCoordinates[0]
  const last = routeCoordinates.at(-1)

  // Durante un desvío se parte desde la posición actual, no desde el inicio.
  const origin = currentPosition ?? first

  if (!validPoint(origin) || !validPoint(last)) {
    throw new Error(
      'Los extremos del recorrido son inválidos.',
    )
  }

  // El clic original puede haberse ajustado a la red.
  // Conservamos el destino efectivo de la ruta aceptada.
  return {
    origin: {
      lng: origin[0],
      lat: origin[1],
    },
    destination: {
      lng: last[0],
      lat: last[1],
    },
  }
}