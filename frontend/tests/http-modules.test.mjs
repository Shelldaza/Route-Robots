import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  requestRandomReport,
} from '../src/features/incidents/random-reports-api.ts'

import {
  fetchPedestrianNetwork,
} from '../src/features/pedestrian/network-api.ts'

import {
  requestWalkSurfaces,
} from '../src/features/incidents/editor-api.ts'

const incident = {
  id: 'one',
  simulationId: 'sim',
  type: 'pothole',
  source: 'ai_generated',
  effect: 'caution',
  description: 'Bache',
  reporterName: 'Robot',

  blockedArea: {
    south: 1,
    north: 2,
    west: 1,
    east: 2,
  },

  createdAt: '2026-10-21T12:00:00Z',
  startsAt: '2026-10-21T12:00:00Z',
  expiresAt: '2026-10-21T12:15:00Z',
}

it('el reporte aleatorio conserva el cuerpo serializado al reintentar', async (t) => {
  const bodies = []

  t.mock.method(
    globalThis,
    'fetch',
    async (_url, init) => {
      bodies.push(init.body)

      return Response.json({
        status: 'created',
        incident,
        onRoute: false,
      })
    },
  )

  const body = JSON.stringify({
    simulationId: 'sim',
    generationId: 'fixed',
    index: 1,
  })

  for (let index = 0; index < 2; index++) {
    const result = await requestRandomReport(
      body,
      'sim',
      new AbortController().signal,
    )

    assert.equal(result.status, 'created')
    assert.equal(result.onRoute, false)
  }

  assert.deepEqual(bodies, [body, body])
})

it('distingue un reporte omitido y rechaza incidentes de otra simulación', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json({
      status: 'skipped',
    }),
  )

  assert.deepEqual(
    await requestRandomReport(
      '{}',
      'sim',
      new AbortController().signal,
    ),
    { status: 'skipped' },
  )

  fetch.mock.mockImplementation(
    async () => Response.json({
      status: 'created',
      incident: {
        ...incident,
        simulationId: 'other',
      },
      onRoute: true,
    }),
  )

  await assert.rejects(
    requestRandomReport(
      '{}',
      'sim',
      new AbortController().signal,
    ),
    /reporte inválido/,
  )
})

it('la API de red utiliza el cliente común y acepta una región sin tramos', async (t) => {
  const data = {
    version: 'v1',
    name: 'Prueba',
    attribution: 'Prueba',
    source: 'fixture',
    retrievedAt: '2026-10-21',

    bounds: {
      south: 1,
      north: 2,
      west: 1,
      east: 2,
    },

    segments: [],
  }

  let url

  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async (value) => {
      url = value
      return Response.json(data)
    },
  )

  assert.deepEqual(
    await fetchPedestrianNetwork(
      new AbortController().signal,
      data.bounds,
    ),
    data,
  )

  assert.match(url, /south=1/)

  fetch.mock.mockImplementation(
    async () => Response.json({
      ...data,
      bounds: {
        ...data.bounds,
        north: -1,
      },
    }),
  )

  await assert.rejects(
    fetchPedestrianNetwork(
      new AbortController().signal,
    ),
    /no es válida/,
  )
})

it('las APIs conservan los errores HTTP y la cancelación', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json(
      { message: 'Servicio ocupado' },
      { status: 503 },
    ),
  )

  await assert.rejects(
    requestRandomReport(
      '{}',
      'sim',
      new AbortController().signal,
    ),
    /Servicio ocupado/,
  )

  const controller = new AbortController()

  controller.abort(
    new DOMException(
      'Cancelado',
      'AbortError',
    ),
  )

  fetch.mock.mockImplementation(
    async (_url, init) => {
      init.signal.throwIfAborted()
    },
  )

  await assert.rejects(
    fetchPedestrianNetwork(
      controller.signal,
    ),
    { name: 'AbortError' },
  )
})

it('la cartografía del editor rechaza superficies incompletas', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json({
      surfaces: [{
        geometry: {
          type: 'MultiPolygon',
          coordinates: [],
        },
      }],
    }),
  )

  await assert.rejects(
    requestWalkSurfaces(
      new URLSearchParams(),
      new AbortController().signal,
    ),
    /cartografía/,
  )
})