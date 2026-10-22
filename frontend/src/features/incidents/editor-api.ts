import type {
  IncidentEffect,
} from '../../../../shared/contracts/incidents'

import type {
  PedestrianSegment,
} from '../../../../shared/contracts/pedestrian'

import type {
  Box,
  Point,
} from '../../../../shared/contracts/surfaces'

import {
  fetchJson,
} from '../../api/client.ts'

import {
  isPedestrianImpact,
} from '../../utils/pedestrian-validation.ts'

import {
  isRecord,
  isEffect,
  isBox,
  isIncidentPreview,
} from './incident-validation.ts'

import {
  post,
} from './incident-api.ts'

export type CatalogEntry = {
  type: string
  label: string
  defaultDescription: string
  defaultDurationMinutes: number
  defaultEffect: IncidentEffect
}

function isCatalogEntry(
  value: unknown,
): value is CatalogEntry {
  return (
    isRecord(value)
    && typeof value.type === 'string'
    && typeof value.label === 'string'
    && typeof value.defaultDescription === 'string'
    && typeof value.defaultDurationMinutes === 'number'
    && Number.isInteger(value.defaultDurationMinutes)
    && value.defaultDurationMinutes > 0
    && isEffect(value.defaultEffect)
  )
}

// El formulario queda listo cuando existen un contexto y un catálogo válidos.
export async function prepareEditor(
  context: {
    simulationId: string
    robotId: string
    networkVersion: string
  },
  signal: AbortSignal,
) {
  const [, value] = await Promise.all([
    fetchJson('/api/surfaces/context', {
      ...post(context),
      signal,
    }),

    fetchJson('/api/incidents/catalog', {
      signal,
    }),
  ])

  if (
    !Array.isArray(value)
    || !value.length
    || !value.every(isCatalogEntry)
  ) {
    throw new Error(
      'El catálogo de incidentes es inválido.',
    )
  }

  return value
}

export type Placement =
  | {
    mode: 'surface'
    box: Box
    message: string
  }
  | {
    mode: 'segment'
    segment: PedestrianSegment
    message: string
  }

export async function requestPlacement(
  simulationId: string,
  networkVersion: string,
  point: Point,
  signal: AbortSignal,
): Promise<Placement> {
  const value = await fetchJson(
    '/api/surfaces/placement',
    {
      ...post({
        simulationId,
        networkVersion,
        point,
      }),
      signal,
    },
    { timeoutMs: 30000 },
  )

  if (isRecord(value)) {
    const message =
      typeof value.message === 'string'
        ? value.message
        : 'Revisá la ubicación y confirmala.'

    if (
      value.mode === 'surface'
      && isBox(value.box)
    ) {
      return {
        mode: 'surface',
        box: value.box,
        message,
      }
    }

    if (
      value.mode === 'segment'
      && isRecord(value.segment)
    ) {
      const impact = {
        networkVersion,
        scope: 'segment',
        segmentIds: [value.segment.id],
        segments: [value.segment],
      }

      if (isPedestrianImpact(impact)) {
        return {
          mode: 'segment',
          segment: impact.segments[0]!,
          message,
        }
      }
    }
  }

  throw new Error(
    'El servidor devolvió una ubicación inválida.',
  )
}

export async function requestPreview(
  body: unknown,
  signal: AbortSignal,
) {
  const value = await fetchJson(
    '/api/surfaces/preview',
    {
      ...post(body),
      signal,
    },
  )

  if (!isIncidentPreview(value)) {
    throw new Error(
      'La vista previa es inválida.',
    )
  }

  return value
}

export async function saveEditorReport(
  endpoint: string,
  body: object,
) {
  await fetchJson(endpoint, post(body))
}