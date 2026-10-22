import type {
  ReplanningResult,
  RouteResponse,
  ToolExecution,
} from '../../../../shared/contracts/routing.ts'

// Valida respuestas externas antes de permitir que lleguen a la simulación.
// TypeScript no puede comprobar por sí solo el JSON recibido por HTTP.
export function isRouteResponse(
  value: unknown,
): value is RouteResponse {
  if (!value || typeof value !== 'object') return false

  const route = value as Record<string, unknown>

  if (!route.geometry || typeof route.geometry !== 'object') {
    return false
  }

  const geometry = route.geometry as Record<string, unknown>

  return (
    geometry.type === 'LineString'
    && Array.isArray(geometry.coordinates)
    && geometry.coordinates.length >= 2
    && geometry.coordinates.every(
      (point: unknown) =>
        Array.isArray(point)
        && point.length === 2
        && typeof point[0] === 'number'
        && Number.isFinite(point[0])
        && point[0] >= -180
        && point[0] <= 180
        && typeof point[1] === 'number'
        && Number.isFinite(point[1])
        && point[1] >= -90
        && point[1] <= 90,
    )
    && typeof route.distanceMeters === 'number'
    && Number.isFinite(route.distanceMeters)
    && route.distanceMeters >= 0
    && typeof route.durationSeconds === 'number'
    && Number.isFinite(route.durationSeconds)
    && route.durationSeconds >= 0
    && (
      route.networkVersion === undefined
      || typeof route.networkVersion === 'string'
    )
    && typeof route.profile === 'string'
  )
}

function isToolExecution(
  value: unknown,
): value is ToolExecution {
  if (!value || typeof value !== 'object') return false

  const tool = value as Record<string, unknown>

  return (
    typeof tool.name === 'string'
    && typeof tool.success === 'boolean'
  )
}

export function isReplanningResult(
  value: unknown,
): value is ReplanningResult {
  if (!value || typeof value !== 'object') return false

  const result = value as Record<string, unknown>

  return (
    typeof result.explanation === 'string'
    && result.explanation.trim().length > 0
    && Array.isArray(result.incidentIds)
    && result.incidentIds.every(
      (id: unknown) => typeof id === 'string',
    )
    && Array.isArray(result.toolCalls)
    && result.toolCalls.every(isToolExecution)
    && (
      (
        result.status === 'alternative_ready'
        && isRouteResponse(result.route)
      )
      || (
        result.status === 'not_replanned'
        && result.route === null
      )
    )
  )
}