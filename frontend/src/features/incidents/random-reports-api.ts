import type {
  IncidentDTO as Incident,
} from '../../../../shared/contracts/incidents'

import {
  fetchJson,
} from '../../api/client.ts'

import {
  isIncident,
  isRecord,
} from './incident-validation.ts'

export type RandomReportResult =
  | {
    status: 'skipped'
  }
  | {
    status: 'created'
    incident: Incident
    onRoute: boolean
  }

// El componente conserva el cuerpo serializado entre reintentos.
// Este módulo se ocupa del transporte y de validar la respuesta.
export async function requestRandomReport(
  body: string,
  simulationId: string,
  signal: AbortSignal,
): Promise<RandomReportResult> {
  const value = await fetchJson(
    '/api/incidents/random',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal,
    },
  )

  if (isRecord(value)) {
    if (value.status === 'skipped') {
      return {
        status: 'skipped',
      }
    }

    if (
      value.status === 'created'
      && isIncident(value.incident)
      && value.incident.simulationId === simulationId
      && typeof value.onRoute === 'boolean'
    ) {
      return {
        status: 'created',
        incident: value.incident,
        onRoute: value.onRoute,
      }
    }
  }

  throw new Error(
    'El servidor devolvió un reporte inválido.',
  )
}