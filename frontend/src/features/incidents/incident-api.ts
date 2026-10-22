import type {
  IncidentDTO as Incident,
} from '../../../../shared/contracts/incidents'

import type {
  Coordinate,
} from '../../../../shared/contracts/geography'

import {
  fetchJson,
  errorMessage,
} from '../../api/client.ts'

import {
  isIncident,
} from './incident-validation.ts'

import {
  createMiddleBlockage,
} from './incident-rules.ts'

export function post(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

export async function fetchIncidentHistory(
  simulationId: string,
  scenarioTime: string,
  signal: AbortSignal,
): Promise<Incident[]> {
  const query = new URLSearchParams({
    simulationId,
    scenarioTime,
    includeHistory: 'true',
  })

  const value = await fetchJson(
    `/api/surfaces/history?${query}`,
    { signal },
  )

  if (
    !Array.isArray(value)
    || !value.every(isIncident)
    || value.some(
      (item) => item.simulationId !== simulationId,
    )
  ) {
    throw new Error(
      'El servidor devolvió incidentes inválidos.',
    )
  }

  return value
}

export async function createQuickIncident(
  simulationId: string,
  startsAt: string,
  coordinates: Coordinate[],
  signal: AbortSignal,
): Promise<Incident> {
  const value = await fetchJson('/api/incidents', {
    ...post({
      simulationId,
      startsAt,
      blockedArea: createMiddleBlockage(coordinates),
      type: 'blockage',
      source: 'simulation',
      durationMinutes: 15,
    }),
    signal,
  })

  if (
    !isIncident(value)
    || value.simulationId !== simulationId
  ) {
    throw new Error(
      'El servidor devolvió un incidente inválido.',
    )
  }

  return value
}

export function incidentErrorMessage(
  error: unknown,
) {
  return (
    error instanceof Error
    && error.name === 'TimeoutError'
  )
    ? 'La operación tardó demasiado. Actualizá los incidentes para comprobar si el reporte se guardó.'
    : errorMessage(error)
}