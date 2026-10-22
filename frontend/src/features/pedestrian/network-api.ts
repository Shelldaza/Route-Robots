import type {
  PedestrianNetwork,
} from '../../../../shared/contracts/pedestrian'

import type {
  Bounds,
} from '../../../../shared/contracts/geography'

import {
  fetchJson,
} from '../../api/client.ts'

import {
  isPedestrianSegment,
} from '../../utils/pedestrian-validation.ts'

import {
  isRecord,
  isBounds,
} from '../../api/validation.ts'

function isNetwork(
  value: unknown,
): value is PedestrianNetwork {
  return (
    isRecord(value)
    && typeof value.version === 'string'
    && typeof value.name === 'string'
    && typeof value.attribution === 'string'
    && typeof value.source === 'string'
    && typeof value.retrievedAt === 'string'
    && isBounds(value.bounds)
    && Array.isArray(value.segments)
    && value.segments.every(isPedestrianSegment)
  )
}

// La respuesta puede contener solo los tramos visibles.
// Una región sin tramos también es una respuesta válida.
export async function fetchPedestrianNetwork(
  signal: AbortSignal,
  bounds?: Bounds,
): Promise<PedestrianNetwork> {
  const query = bounds
    ? `?${new URLSearchParams({
      south: String(bounds.south),
      west: String(bounds.west),
      north: String(bounds.north),
      east: String(bounds.east),
    })}`
    : ''

  const value = await fetchJson(
    `/api/pedestrian-network${query}`,
    { signal },
  )

  if (!isNetwork(value)) {
    throw new Error(
      'La red peatonal recibida no es válida.',
    )
  }

  return value
}