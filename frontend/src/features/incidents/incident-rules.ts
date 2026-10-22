import {
  sameValue,
} from '../../../../shared/values.ts';
import type {
  IncidentDTO as Incident,
  IncidentEffect,
  IncidentStatus,
  IncidentType,
} from '../../../../shared/contracts/incidents'

import type {
  Bounds,
  Coordinate,
} from '../../../../shared/contracts/geography'

import {
  lineHits,
} from '../../../../shared/surfaces.ts'

import {
  getRouteBlockages,
} from '../../utils/route-geometry.ts'

import {
  buildPath,
  samplePath,
} from '../../utils/simulation-path.ts'

// Reglas de vigencia y alcance.
// No consultan HTTP ni modifican React.
export const INCIDENT_LABELS: Record<
  IncidentType | 'blockage',
  string
> = {
  blockage: 'Bloqueo',
  temporary_obstacle: 'Obstáculo temporal',
  temporary_closure: 'Cierre temporal',
  roadworks: 'Obras',
  standing_water: 'Acumulación de agua',
  crowd: 'Aglomeración de personas',
  obstructing_vehicle: 'Vehículo obstruyendo el paso',
  scheduled_event: 'Evento programado',
  pothole: 'Bache',
  uneven_surface: 'Superficie irregular',
}

export const EFFECT_LABELS: Record<
  IncidentEffect,
  string
> = {
  informational: 'Informativo',
  caution: 'Precaución',
  blockage: 'Bloqueo',
}

export const STATUS_LABELS: Record<
  IncidentStatus,
  string
> = {
  scheduled: 'Programado',
  active: 'Activo',
  finished: 'Finalizado',
}

export function getIncidentStatus(
  incident: Pick<Incident, 'startsAt' | 'expiresAt'>,
  nowMs: number,
): IncidentStatus {
  if (Date.parse(incident.startsAt) > nowMs) {
    return 'scheduled'
  }

  if (Date.parse(incident.expiresAt) <= nowMs) {
    return 'finished'
  }

  return 'active'
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function mergeIncidents(
  current: Incident[],
  incoming: Incident[],
): Incident[] {
  const records = new Map(
    current.map((incident) => [
      incident.id,
      incident,
    ]),
  )

  for (const incident of incoming) {
    const previous = records.get(incident.id);

    records.set(
      incident.id,
      previous && sameValue(previous, incident)
        ? previous
        : incident,
    );
  }

  return [...records.values()].sort(
    (a, b) =>
      Date.parse(b.startsAt)
      - Date.parse(a.startsAt),
  )
}

export function getIncidentSummary(
  records: Incident[],
  coordinates: Coordinate[],
  at: string,
) {
  const nowMs = Date.parse(at)

  const active = records.filter(
    (item) => getIncidentStatus(item, nowMs) === 'active',
  )

  const routeBlockages = [
    ...getRouteBlockages(
      coordinates,
      active.filter((item) => !item.surfaceImpact),
    ),

    ...active.filter((item) =>
      item.effect === 'blockage'
      && item.surfaceImpact
      && lineHits(
        coordinates,
        item.surfaceImpact.collisionGeometry,
      )
    ),
  ]

  const finished = records.filter(
    (item) =>
      getIncidentStatus(item, nowMs) === 'finished',
  ).length

  return {
    nowMs,
    active,
    routeBlockages,
    finished,
    scheduled: records.length - active.length - finished,
  }
}

// La prueba rápida coloca un bloqueo en la mitad de la distancia.
// Reutiliza la geometría de la simulación y evita depender de Leaflet.
export function createMiddleBlockage(
  coordinates: Coordinate[],
): Bounds {
  const path = buildPath(coordinates)

  if (path.lengthMeters < 80) {
    throw new Error(
      'Para esta prueba necesitás al menos 80 metros de recorrido pendiente.',
    )
  }

  const center = samplePath(path, 0.5).position
  const origin = coordinates[0]
  const destination = coordinates.at(-1)

  if (!center || !origin || !destination) {
    throw new Error(
      'No se pudo ubicar el bloqueo sobre el recorrido.',
    )
  }

  const dy = 10 / 111320

  const dx =
    dy / Math.cos(center[1] * Math.PI / 180)

  const area: Bounds = {
    south: center[1] - dy,
    north: center[1] + dy,
    west: center[0] - dx,
    east: center[0] + dx,
  }

  const inside = ([lng, lat]: Coordinate) =>
    lng >= area.west
    && lng <= area.east
    && lat >= area.south
    && lat <= area.north

  if (inside(origin) || inside(destination)) {
    throw new Error(
      'El bloqueo quedaría sobre el robot o el destino. Probá otro recorrido.',
    )
  }

  return area
}
