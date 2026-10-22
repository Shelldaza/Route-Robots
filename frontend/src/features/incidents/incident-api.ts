import type {
  IncidentSnapshotDTO,
  IncidentSummaryDTO,
} from '../../../../shared/contracts/incidents';

import {
  isRecord,
  isDateString,
} from '../../api/validation.ts';

import {
  isEffect,
  isIncidentType,
} from './incident-validation.ts';
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
function isIncidentSummary(
  value: unknown,
): value is IncidentSummaryDTO {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && Boolean(value.id)
    && typeof value.simulationId === 'string'
    && isIncidentType(value.type)
    && [
      'simulation',
      'manual',
      'ai_generated',
    ].includes(String(value.source))
    && typeof value.description === 'string'
    && isEffect(value.effect)
    && (
      value.reporterName === null
      || typeof value.reporterName === 'string'
    )
    && isDateString(value.createdAt)
    && isDateString(value.startsAt)
    && isDateString(value.expiresAt)
    && Date.parse(value.expiresAt)
      > Date.parse(value.startsAt)
    && [
      'surface',
      'segment',
      'area',
    ].includes(String(value.placementKind))
  );
}

export async function fetchIncidentDetail(
  simulationId: string,
  scenarioTime: string,
  incidentId: string,
  signal: AbortSignal,
): Promise<Incident> {
  const query = new URLSearchParams({
    simulationId,
    scenarioTime,
    incidentId,
  });

  const value = await fetchJson(
    '/api/surfaces/history?' + query,
    { signal },
  );

  if (
    !isIncident(value)
    || value.id !== incidentId
    || value.simulationId !== simulationId
  ) {
    throw new Error(
      'El servidor devolvió un detalle inválido.',
    );
  }

  return value;
}

export async function fetchIncidentSnapshot(
  simulationId: string,
  scenarioTime: string,
  signal: AbortSignal,
): Promise<IncidentSnapshotDTO> {
  const query = new URLSearchParams({
    simulationId,
    scenarioTime,
  });

  const value = await fetchJson(
    '/api/surfaces/snapshot?' + query,
    { signal },
  );

  if (
    !isRecord(value)
    || !Array.isArray(value.history)
    || !value.history.every(isIncidentSummary)
    || !Array.isArray(value.active)
    || !value.active.every(isIncident)
    || value.history.some(
      (item) => item.simulationId !== simulationId,
    )
    || value.active.some(
      (item) => item.simulationId !== simulationId,
    )
    || new Set(
      value.history.map((item) => item.id),
    ).size !== value.history.length
    || new Set(
      value.active.map((item) => item.id),
    ).size !== value.active.length
  ) {
    throw new Error(
      'El servidor devolvió incidentes inválidos.',
    );
  }

  const active = value.active;
  const history = value.history;

  const expected = history.filter(
    (item) =>
      Date.parse(item.startsAt) <= Date.parse(scenarioTime)
      && Date.parse(item.expiresAt) > Date.parse(scenarioTime),
  );

  // Un resumen activo sin sus datos de mapa no puede
  // interpretarse silenciosamente como un incidente inexistente.
  if (
    expected.length !== active.length
    || expected.some(
      (item) => !active.some(
        (record) => record.id === item.id,
      ),
    )
  ) {
    throw new Error(
      'Faltan geometrías de incidentes activos.',
    );
  }

  return {
    history,
    active,
  };
}
