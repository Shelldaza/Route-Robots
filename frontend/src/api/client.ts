// Transporte HTTP común.
// Los consumidores validan luego la forma del JSON.

export type RequestOptions = {
  timeoutMs?: number
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<unknown> {
  // Combina la cancelación del consumidor con el tiempo máximo
  // de esta operación. El valor habitual sigue siendo 40 segundos.
  const timeoutMs = options.timeoutMs ?? 40000

  const response = await fetch(url, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([
          init.signal,
          AbortSignal.timeout(timeoutMs),
        ])
      : AbortSignal.timeout(timeoutMs),
  })

  // Mantiene el comportamiento existente:
  // una respuesta sin JSON produce null.
  const body: unknown = await response.json().catch(() => null)

  // Ante un rechazo HTTP, prioriza el mensaje del backend.
  if (!response.ok) {
    const message =
      body
      && typeof body === 'object'
      && 'message' in body
      && typeof body.message === 'string'
        ? body.message
        : 'No se pudo completar la operación.'

    throw new Error(message)
  }

  return body
}

// Convierte errores técnicos en mensajes para la interfaz.
export function errorMessage(error: unknown): string {
  if (
    error instanceof Error
    && error.name === 'TimeoutError'
  ) {
    return 'La consulta tardó demasiado. Intentá nuevamente.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}