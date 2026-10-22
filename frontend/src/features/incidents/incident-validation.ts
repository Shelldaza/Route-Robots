import type {
  IncidentDTO,
  IncidentEffect,
  IncidentType,
} from '../../../../shared/contracts/incidents'

import type {
  Coordinate,
  Bounds,
} from '../../../../shared/contracts/geography'

import type {
  Area,
  Box,
  SurfaceImpact,
  WalkSurface,
} from '../../../../shared/contracts/surfaces'

import {
  isArea,
} from '../../../../shared/surfaces.ts'

import {
  isPedestrianImpact,
} from '../../utils/pedestrian-validation.ts'

import {
  INCIDENT_LABELS,
} from './incident-rules.ts'

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

export function isEffect(
  value: unknown,
): value is IncidentEffect {
  return (
    value === 'informational'
    || value === 'caution'
    || value === 'blockage'
  )
}

export function isIncidentType(
  value: unknown,
): value is IncidentType | 'blockage' {
  return (
    typeof value === 'string'
    && Object.hasOwn(INCIDENT_LABELS, value)
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

export function isBox(
  value: unknown,
): value is Box {
  return (
    isRecord(value)
    && isCoordinate(value.center)
    && isFiniteNumber(value.halfWidth)
    && value.halfWidth > 0
    && isFiniteNumber(value.halfLength)
    && value.halfLength > 0
    && isFiniteNumber(value.angle)
  )
}

export function isWalkSurface(
  value: unknown,
): value is WalkSurface {
  return (
    isRecord(value)
    && isFiniteNumber(value.id)
    && isFiniteNumber(value.code)
    && (
      value.capturedAt === null
      || isDateString(value.capturedAt)
    )
    && isArea(value.geometry)
  )
}

export function isSurfaceImpact(
  value: unknown,
): value is SurfaceImpact {
  return (
    isRecord(value)
    && isArea(value.geometry)
    && isArea(value.collisionGeometry)
    && Array.isArray(value.surfaces)
    && value.surfaces.every(isWalkSurface)
    && (
      value.contextSurfaces === undefined
      || (
        Array.isArray(value.contextSurfaces)
        && value.contextSurfaces.every(isWalkSurface)
      )
    )
    && Array.isArray(value.segmentIds)
    && value.segmentIds.every(
      (id) => typeof id === 'string',
    )
    && typeof value.source === 'string'
    && isDateString(value.retrievedAt)
    && isBox(value.box)
    && typeof value.unknown === 'boolean'
  )
}

export function isIncident(
  value: unknown,
): value is IncidentDTO {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.simulationId === 'string'
    && isIncidentType(value.type)
    && (
      value.source === 'simulation'
      || value.source === 'manual'
      || value.source === 'ai_generated'
    )
    && typeof value.description === 'string'
    && isEffect(value.effect)
    && (
      value.reporterName === null
      || typeof value.reporterName === 'string'
    )
    && (
      value.pedestrianImpact == null
      || isPedestrianImpact(value.pedestrianImpact)
    )
    && (
      value.surfaceImpact == null
      || isSurfaceImpact(value.surfaceImpact)
    )
    && isBounds(value.blockedArea)
    && isDateString(value.createdAt)
    && isDateString(value.startsAt)
    && isDateString(value.expiresAt)
    && Date.parse(value.expiresAt)
      > Date.parse(value.startsAt)
  )
}

export type IncidentPreview = {
  impact: SurfaceImpact
  analysis: {
    state: string
    message: string
    coordinates: Coordinate[]
    free: Area
  }
}

export function isIncidentPreview(
  value: unknown,
): value is IncidentPreview {
  return (
    isRecord(value)
    && isSurfaceImpact(value.impact)
    && isRecord(value.analysis)
    && typeof value.analysis.state === 'string'
    && typeof value.analysis.message === 'string'
    && Array.isArray(value.analysis.coordinates)
    && value.analysis.coordinates.every(isCoordinate)
    && isArea(value.analysis.free)
  )
}