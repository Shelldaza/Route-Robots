// Validaciones básicas para datos externos; no dependen de una funcionalidad.
import type { Coordinate, Bounds } from '../../../shared/contracts/geography';


// El JSON recibido sigue siendo unknown hasta verificar su estructura.
export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
  )
}


export function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
  )
}


export function isCoordinate(
  value: unknown,
): value is Coordinate {
  return (
    Array.isArray(value)
    && value.length === 2
    && isFiniteNumber(value[0])
    && Math.abs(value[0]) <= 180
    && isFiniteNumber(value[1])
    && Math.abs(value[1]) <= 90
  )
}


export function isDateString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string'
    && Number.isFinite(Date.parse(value))
  )
}


export function isBounds(
  value: unknown,
): value is Bounds {
  return (
    isRecord(value)
    && isFiniteNumber(value.south)
    && isFiniteNumber(value.north)
    && isFiniteNumber(value.west)
    && isFiniteNumber(value.east)
    && value.south >= -90
    && value.north <= 90
    && value.south < value.north
    && value.west >= -180
    && value.east <= 180
    && value.west < value.east
  )
}