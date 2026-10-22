import type {
  Coordinate,
} from '../../../../shared/contracts/geography'

import type {
  IncidentEffect,
} from '../../../../shared/contracts/incidents'

import type {
  IncidentSelection,
} from '../../components/incident-map-editor'

import type {
  EditorScope,
} from './editor-state'

export type Submission = {
  key: string
  endpoint: string
  body: object
}

type Draft = {
  contextKey: string
  simulationId: string
  networkVersion: string
  coordinates: Coordinate[]
  selection: IncidentSelection
  type: string
  effect: IncidentEffect
  description: string
  durationMinutes: number
  multiple: boolean
  scope: EditorScope
}

// El backend puede haber guardado antes de fallar la actualización del historial.
// Reutilizar la petición evita duplicar el incidente al reintentar.
export function prepareSubmission(
  previous: Submission | null,
  draft: Draft,
  getTime: () => string,
  createId = () => crypto.randomUUID(),
): Submission {
  const {
    contextKey,
    selection,
    type,
    effect,
    durationMinutes,
    multiple,
    scope,
  } = draft

  const description = draft.description.trim()

  const key = JSON.stringify({
    contextKey,
    selection,
    type,
    effect,
    description,
    durationMinutes,
    multiple,
    scope,
  })

  if (previous?.key === key) {
    return previous
  }

  const at = getTime()

  const common = {
    id: createId(),
    simulationId: draft.simulationId,
    networkVersion: draft.networkVersion,
    scenarioTime: at,
    startsAt: at,
    coordinates: draft.coordinates,
    type,
    effect,
    description,
    durationMinutes,
  }

  return selection.mode === 'surface'
    ? {
      key,
      endpoint: '/api/surfaces/incidents',
      body: {
        ...common,
        box: selection.box,
        multipleSurfaces: multiple,
      },
    }
    : {
      key,
      endpoint: '/api/surfaces/segments',
      body: {
        ...common,
        pedestrianSelection: {
          networkVersion: draft.networkVersion,
          scope,
          segmentIds: selection.segments.map(
            (item) => item.id,
          ),
        },
      },
    }
}