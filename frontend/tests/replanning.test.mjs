import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  createReplanningController,
} from '../src/features/simulation/replanning-controller.ts'

import {
  requestInitialRoute,
  requestRouteEvaluation,
} from '../src/features/simulation/routing-api.ts'

// Cada prueba controla la respuesta HTTP.
const route = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [-77.04, 38.9],
      [-77.039, 38.9],
    ],
  },
  distanceMeters: 100,
  durationSeconds: 72,
  profile: 'foot-walking',
  networkVersion: 'test',
}

const result = {
  status: 'alternative_ready',
  route,
  explanation: 'Se calculó una alternativa.',
  incidentIds: ['incident-1'],
  toolCalls: [{
    name: 'calcular_desvio',
    success: true,
  }],
}

// Permite decidir cuándo termina una respuesta.
// Se utiliza para reproducir peticiones simultáneas y respuestas tardías.
function deferred() {
  let resolve

  const promise = new Promise((done) => {
    resolve = done
  })

  return {
    promise,
    resolve,
  }
}

function setup(overrides = {}) {
  const applied = []
  const events = []

  const dependencies = {
    simulationId: 'simulation-1',
    route,

    pauseRobot: () =>
      events.push('robot-paused'),

    pauseScenario: () =>
      events.push('scenario-paused'),

    getScenarioTime: () =>
      '2026-10-20T12:00:00.000Z',

    getMotionSnapshot: () => ({
      position: [-77.0398, 38.9],
      remainingMeters: 80,
      remainingCoordinates: [
        [-77.0398, 38.9],
        [-77.039, 38.9],
      ],
    }),

    loadRoute: (next, preserveProgress) =>
      applied.push({
        route: next,
        preserveProgress,
      }),

    ...overrides,
  }

  return {
    controller: createReplanningController(dependencies),
    applied,
    events,
  }
}

it('pausa, envía la posición actual y conserva el recorrido pendiente', async (t) => {
  let sent

  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    sent = JSON.parse(init.body)

    return Response.json(result)
  })

  const {
    controller,
    applied,
    events,
  } = setup()

  await controller.request()

  assert.deepEqual(events, [
    'robot-paused',
    'scenario-paused',
  ])

  assert.deepEqual(sent.origin, {
    lng: -77.0398,
    lat: 38.9,
  })

  assert.deepEqual(sent.destination, {
    lng: -77.039,
    lat: 38.9,
  })

  assert.equal(
    sent.scenarioTime,
    '2026-10-20T12:00:00.000Z',
  )

  assert.equal(sent.networkVersion, 'test')

  assert.deepEqual(sent.preferredCoordinates, [
    [-77.0398, 38.9],
    [-77.039, 38.9],
  ])

  assert.equal(applied.length, 1)
  assert.equal(applied[0].preserveProgress, true)
  assert.equal(controller.getState().comparisonDistance, 80)
  assert.equal(controller.getState().status, 'ready')
})

it('dos solicitudes simultáneas producen una sola consulta', async (t) => {
  const response = deferred()
  let requests = 0

  t.mock.method(globalThis, 'fetch', async () => {
    requests++

    return response.promise
  })

  const { controller } = setup()

  const first = controller.request()
  await controller.request()

  assert.equal(requests, 1)
  assert.equal(controller.isPending(), true)

  response.resolve(Response.json(result))
  await first

  assert.equal(controller.isPending(), false)
})

it('una evaluación sin alternativa no aplica ninguna ruta', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...result,
      status: 'not_replanned',
      route: null,
    })
  )

  const {
    controller,
    applied,
  } = setup()

  await controller.request()

  assert.equal(
    controller.getState().status,
    'unavailable',
  )

  assert.equal(
    controller.getState().alternative,
    null,
  )

  assert.equal(applied.length, 0)
})

it('rechaza una alternativa de otra versión de red', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...result,
      route: {
        ...route,
        networkVersion: 'another-network',
      },
    })
  )

  const {
    controller,
    applied,
  } = setup()

  await controller.request()

  assert.equal(controller.getState().status, 'error')

  assert.match(
    controller.getState().error,
    /otra red peatonal/,
  )

  assert.equal(applied.length, 0)
})

it('una explicación no puede reemplazar una geometría válida', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...result,
      route: null,
    })
  )

  const {
    controller,
    applied,
  } = setup()

  await controller.request()

  assert.equal(controller.getState().status, 'error')
  assert.equal(applied.length, 0)
})

it('rechaza coordenadas fuera de los límites geográficos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...result,
      route: {
        ...route,
        geometry: {
          type: 'LineString',
          coordinates: [
            [200, 38.9],
            [-77.039, 38.9],
          ],
        },
      },
    })
  )

  const {
    controller,
    applied,
  } = setup()

  await controller.request()

  assert.equal(controller.getState().status, 'error')
  assert.equal(applied.length, 0)
})

it('si el robot rechaza la continuidad, no publica la alternativa', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(result)
  )

  const { controller } = setup({
    loadRoute: () => {
      throw new Error(
        'El desvío no conecta con el robot.',
      )
    },
  })

  await controller.request()

  assert.equal(controller.getState().status, 'error')
  assert.equal(controller.getState().alternative, null)

  assert.equal(
    controller.getState().error,
    'El desvío no conecta con el robot.',
  )
})

it('una respuesta cancelada no puede sobrescribir una evaluación nueva', async (t) => {
  const oldResponse = deferred()
  const newResponse = deferred()
  let calls = 0

  // Simula un transporte que responde incluso después de ser cancelado.
  t.mock.method(globalThis, 'fetch', async () =>
    ++calls === 1
      ? oldResponse.promise
      : newResponse.promise
  )

  const {
    controller,
    applied,
  } = setup()

  const first = controller.request()

  controller.cancel()

  const second = controller.request()

  oldResponse.resolve(
    Response.json({
      ...result,
      explanation: 'Respuesta anterior.',
    }),
  )

  await first

  assert.equal(controller.isPending(), true)
  assert.equal(controller.getState().status, 'loading')
  assert.equal(applied.length, 0)

  newResponse.resolve(Response.json(result))
  await second

  assert.equal(applied.length, 1)

  assert.equal(
    controller.getState().explanation,
    result.explanation,
  )

  assert.equal(controller.isPending(), false)
})

it('conserva el mensaje de error enviado por el backend', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        message: 'La red cambió.',
      },
      {
        status: 409,
      },
    )
  )

  const { controller } = setup()

  await controller.request()

  assert.equal(controller.getState().status, 'error')
  assert.equal(controller.getState().error, 'La red cambió.')
  assert.equal(controller.isPending(), false)
})

it('sin una ruta base no inicia la evaluación', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json(result),
  )

  const {
    controller,
    events,
  } = setup({
    route: null,
  })

  await controller.request()

  assert.equal(fetchMock.mock.callCount(), 0)
  assert.equal(events.length, 0)
  assert.equal(controller.getState().status, 'idle')
})

it('conserva 25 segundos para la ruta inicial y 120 para la evaluación', async (t) => {
  const timeouts = []

  t.mock.method(
    AbortSignal,
    'timeout',
    (milliseconds) => {
      timeouts.push(milliseconds)

      return new AbortController().signal
    },
  )

  t.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(
      url === '/api/routes'
        ? route
        : result,
    )
  )

  const signal = new AbortController().signal

  await requestInitialRoute(
    {
      origin: {
        lng: -77.04,
        lat: 38.9,
      },
      destination: {
        lng: -77.039,
        lat: 38.9,
      },
      networkVersion: 'test',
    },
    signal,
  )

  await requestRouteEvaluation(
    {
      simulationId: 'simulation-1',
      origin: {
        lng: -77.04,
        lat: 38.9,
      },
      destination: {
        lng: -77.039,
        lat: 38.9,
      },
      scenarioTime: '2026-10-20T12:00:00.000Z',
      networkVersion: 'test',
    },
    signal,
  )

  assert.deepEqual(timeouts, [
    25000,
    120000,
  ])
})

it('la ruta inicial también debe corresponder a la red solicitada', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...route,
      networkVersion: 'another-network',
    })
  )

  await assert.rejects(
    requestInitialRoute(
      {
        origin: {
          lng: -77.04,
          lat: 38.9,
        },
        destination: {
          lng: -77.039,
          lat: 38.9,
        },
        networkVersion: 'test',
      },
      new AbortController().signal,
    ),
    /ruta inválida/,
  )
})