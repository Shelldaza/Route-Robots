import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  errorMessage,
  fetchJson,
} from '../src/api/client.ts'

// Se simula fetch para comprobar el contrato HTTP sin llamar a servicios reales.
it('devuelve el JSON y conserva el método y cuerpo del pedido', async (t) => {
  let request

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    request = { url, init }

    return Response.json({ id: 'robot-1' })
  })

  const body = JSON.stringify({ name: 'Robot de prueba' })

  const result = await fetchJson('/api/robots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  assert.deepEqual(result, { id: 'robot-1' })
  assert.equal(request.url, '/api/robots')
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.body, body)

  assert.equal(
    new Headers(request.init.headers).get('Content-Type'),
    'application/json',
  )
})

it('conserva el mensaje de un rechazo del backend', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { message: 'El nombre del robot ya existe.' },
      { status: 409 },
    )
  )

  await assert.rejects(
    fetchJson('/api/robots'),
    { message: 'El nombre del robot ya existe.' },
  )
})

it('usa un mensaje general si el rechazo no contiene JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('Servicio no disponible', { status: 503 })
  )

  await assert.rejects(
    fetchJson('/api/robots'),
    { message: 'No se pudo completar la operación.' },
  )
})

it('mantiene null para una respuesta exitosa sin JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(null, { status: 204 })
  )

  assert.equal(await fetchJson('/api/robots'), null)
})

it('respeta la cancelación solicitada por el consumidor', async (t) => {
  const controller = new AbortController()

  const reason = new DOMException(
    'Consulta cancelada',
    'AbortError',
  )

  controller.abort(reason)

  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    init.signal.throwIfAborted()

    return Response.json({})
  })

  await assert.rejects(
    fetchJson('/api/robots', {
      signal: controller.signal,
    }),
    {
      name: 'AbortError',
      message: 'Consulta cancelada',
    },
  )
})

it('conserva los mensajes de timeout, conexión y errores generales', () => {
  assert.equal(
    errorMessage(
      new DOMException('Timeout', 'TimeoutError'),
    ),
    'La consulta tardó demasiado. Intentá nuevamente.',
  )

  assert.equal(
    errorMessage(new TypeError('Failed to fetch')),
    'No se pudo conectar con el backend.',
  )

  assert.equal(
    errorMessage(
      new Error('Error informado por el servicio'),
    ),
    'Error informado por el servicio',
  )

  assert.equal(
    errorMessage(null),
    'Ocurrió un error inesperado.',
  )
})