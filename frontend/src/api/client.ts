// Transporte HTTP común. Los consumidores validan luego la forma del JSON.

export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  // Conserva la cancelación del consumidor y agrega un máximo de 40 segundos.
  const response = await fetch(url, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([
          init.signal,
          AbortSignal.timeout(40000),
        ])
      : AbortSignal.timeout(40000),
  })

  // Mantiene el comportamiento actual: una respuesta sin JSON produce null.
  const body: unknown = await response.json().catch(() => null)

  // Ante un rechazo HTTP, prioriza el mensaje enviado por el backend.
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