import { fetchJson } from '../../api/client.ts'

import {
  isReplanningResult,
  isRouteResponse,
} from './routing-validation.ts'

import type { GeographicPoint } from '../../../../shared/contracts/geography'
import type { ReplanningRequest, ReplanningResult, RouteResponse } from '../../../../shared/contracts/routing.ts'

// Solicita la ruta inicial y comprueba que pertenezca
// a la misma versión de red que eligió el usuario.
export async function requestInitialRoute(
  input: {
    origin: GeographicPoint
    destination: GeographicPoint
    networkVersion?: string
  },
  signal: AbortSignal,
): Promise<RouteResponse> {
  const body = await fetchJson(
    '/api/routes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: input.origin,
        destination: input.destination,
        ...(input.networkVersion
          ? { networkVersion: input.networkVersion }
          : {}),
      }),
      signal,
    },
    {
      timeoutMs: 25000,
    },
  )

  if (
    !isRouteResponse(body)
    || body.networkVersion !== input.networkVersion
  ) {
    throw new Error(
      'El servidor devolvió una ruta inválida.',
    )
  }

  return body
}

// La evaluación incluye consultas mediante IA y MCP.
// Conserva el límite de 120 segundos que tenía la página.
export async function requestRouteEvaluation(
  input: ReplanningRequest,
  signal: AbortSignal,
): Promise<ReplanningResult> {
  const body = await fetchJson(
    '/api/replanning',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    },
    {
      timeoutMs: 120000,
    },
  )

  if (!isReplanningResult(body)) {
    throw new Error(
      'El servidor devolvió una evaluación con datos inválidos.',
    )
  }

  return body
}

// Conserva los mensajes que ya utilizaba la pantalla de simulación.
export function simulationErrorMessage(error: unknown): string {
  if (
    error instanceof Error
    && error.name === 'TimeoutError'
  ) {
    return 'La operación tardó demasiado. No se aplicaron cambios en esta pantalla.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}