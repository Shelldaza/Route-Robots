import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  getIncidentStatus,
  getIncidentSummary,
  mergeIncidents,
  createMiddleBlockage,
} from '../src/features/incidents/incident-rules.ts'

import {
  fetchIncidentHistory,
} from '../src/features/incidents/incident-api.ts'

import {
  requestPlacement,
  requestPreview,
  prepareEditor,
} from '../src/features/incidents/editor-api.ts'

import {
  isIncident,
} from '../src/features/incidents/incident-validation.ts'

const at = '2026-10-21T12:00:00.000Z'

const area = {
  type: 'MultiPolygon',
  coordinates: [[[
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ]]],
}

const incident = {
  id: 'one',
  simulationId: 'sim',
  type: 'pothole',
  source: 'manual',
  description: 'Bache',
  effect: 'blockage',
  reporterName: null,
  blockedArea: {
    south: 0,
    north: 2,
    west: 0,
    east: 2,
  },
  createdAt: at,
  startsAt: at,
  expiresAt: '2026-10-21T12:15:00.000Z',
}

it('la vigencia incluye el comienzo y excluye el vencimiento', () => {
  assert.equal(
    getIncidentStatus(incident, Date.parse(at) - 1),
    'scheduled',
  )

  assert.equal(
    getIncidentStatus(incident, Date.parse(at)),
    'active',
  )

  assert.equal(
    getIncidentStatus(
      incident,
      Date.parse(incident.expiresAt),
    ),
    'finished',
  )
})

it('las precauciones y los incidentes vencidos no bloquean el recorrido', () => {
  const records = [
    incident,
    {
      ...incident,
      id: 'notice',
      effect: 'caution',
    },
    {
      ...incident,
      id: 'old',
      expiresAt: at,
    },
  ]

  const result = getIncidentSummary(
    records,
    [[-1, 1], [3, 1]],
    at,
  )

  assert.deepEqual(
    result.routeBlockages.map((item) => item.id),
    ['one'],
  )

  assert.equal(result.active.length, 2)
  assert.equal(result.finished, 1)
})

it('una superficie usa su colisión y deja libre la vereda de enfrente', () => {
  const report = {
    ...incident,
    surfaceImpact: {
      geometry: area,
      collisionGeometry: area,
    },
  }

  assert.equal(
    getIncidentSummary(
      [report],
      [[-1, 1], [3, 1]],
      at,
    ).routeBlockages.length,
    1,
  )

  assert.equal(
    getIncidentSummary(
      [report],
      [[-1, 3], [3, 3]],
      at,
    ).routeBlockages.length,
    0,
  )
})

it('actualiza por ID sin duplicar el historial', () => {
  const updated = {
    ...incident,
    description: 'Actualizado',
  }

  assert.deepEqual(
    mergeIncidents([incident], [updated]),
    [updated],
  )
})

it('el bloqueo rápido se ubica a mitad del recorrido y evita sus extremos', () => {
  const box = createMiddleBlockage([
    [-77.04, 38.9],
    [-77.038, 38.9],
  ])

  assert.ok(box.west < -77.039 && box.east > -77.039)
  assert.ok(box.west > -77.04 && box.east < -77.038)

  assert.throws(
    () => createMiddleBlockage([
      [-77.04, 38.9],
      [-77.0399, 38.9],
    ]),
    /80 metros/,
  )
})

it('rechaza historiales de otra simulación y mantiene el mensaje del backend', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json([{
      ...incident,
      simulationId: 'other',
    }]),
  )

  await assert.rejects(
    fetchIncidentHistory(
      'sim',
      at,
      new AbortController().signal,
    ),
    /inválidos/,
  )

  fetch.mock.mockImplementation(
    async () => Response.json(
      { message: 'No disponible' },
      { status: 503 },
    ),
  )

  await assert.rejects(
    fetchIncidentHistory(
      'sim',
      at,
      new AbortController().signal,
    ),
    /No disponible/,
  )
})

it('una superficie incompleta no se acepta como incidente válido', () => {
  assert.equal(isIncident(incident), true)

  assert.equal(
    isIncident({
      ...incident,
      surfaceImpact: {
        geometry: area,
        collisionGeometry: area,
      },
    }),
    false,
  )
})

it('rechaza ubicaciones y vistas previas incompletas antes de usarlas en el editor', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json({
      mode: 'surface',
      box: {
        center: [0, 0],
      },
    }),
  )

  await assert.rejects(
    requestPlacement(
      'sim',
      'v1',
      [0, 0],
      new AbortController().signal,
    ),
    /ubicación inválida/,
  )

  await assert.rejects(
    requestPreview(
      {},
      new AbortController().signal,
    ),
    /vista previa es inválida/,
  )
})

it('el catálogo no acepta efectos desconocidos', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async (url) => Response.json(
      url.endsWith('/catalog')
        ? [{
          type: 'pothole',
          label: 'Bache',
          defaultDescription: 'Bache',
          defaultDurationMinutes: 15,
          defaultEffect: 'unknown',
        }]
        : {},
    ),
  )

  await assert.rejects(
    prepareEditor(
      {
        simulationId: 'sim',
        robotId: 'robot',
        networkVersion: 'v1',
      },
      new AbortController().signal,
    ),
    /catálogo/,
  )
})