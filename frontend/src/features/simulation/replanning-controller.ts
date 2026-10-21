import {
  replanningEndpoints,
} from '../../../../shared/routing/replanning-endpoints.ts'

import {
  requestRouteEvaluation,
  simulationErrorMessage,
} from './routing-api.ts'

import type { Coordinate } from '../../../../shared/contracts/geography'
import type { ReplanningStatus, RouteResponse, ToolExecution } from '../../../../shared/contracts/routing.ts'

// Solo necesitamos estos datos del robot.
// El controlador no conoce React, el mapa ni la implementación de la animación.
type MotionSnapshot = {
  position: Coordinate | null
  remainingMeters: number
  remainingCoordinates: Coordinate[]
}

export type ReplanningDependencies = {
  simulationId: string
  route: RouteResponse | null
  pauseRobot: () => void
  pauseScenario: () => void
  getScenarioTime: () => string
  getMotionSnapshot: () => MotionSnapshot
  loadRoute: (
    route: RouteResponse,
    preserveProgress: boolean,
  ) => void
}

export type ReplanningState = {
  status: ReplanningStatus
  alternative: RouteResponse | null
  error: string
  explanation: string
  toolCalls: ToolExecution[]
  comparisonDistance: number | null
}

export function createReplanningController(
  dependencies: ReplanningDependencies,
) {
  let state: ReplanningState = {
    status: 'idle',
    alternative: null,
    error: '',
    explanation: '',
    toolCalls: [],
    comparisonDistance: null,
  }

  let activeRequest: AbortController | null = null

  // React se suscribe a estos cambios mediante el hook useReplanning.
  const listeners = new Set<() => void>()

  function update(changes: Partial<ReplanningState>) {
    state = {
      ...state,
      ...changes,
    }

    listeners.forEach((listener) => listener())
  }

  async function request() {
    const route = dependencies.route

    if (!route || activeRequest) return

    // El bloqueo es inmediato: dos clics antes del próximo render
    // tampoco pueden iniciar evaluaciones simultáneas.
    const controller = new AbortController()
    activeRequest = controller

    try {
      dependencies.pauseRobot()
      dependencies.pauseScenario()

      // La fecha y la posición se capturan una sola vez, después de pausar.
      const scenarioTime = dependencies.getScenarioTime()
      const current = dependencies.getMotionSnapshot()

      update({
        status: 'loading',
        alternative: null,
        error: '',
        explanation: '',
        toolCalls: [],
        comparisonDistance: current.remainingMeters,
      })

      const endpoints = replanningEndpoints(
        route.geometry.coordinates,
        current.position,
      )

      const result = await requestRouteEvaluation(
        {
          simulationId: dependencies.simulationId,
          ...endpoints,
          scenarioTime,

          ...(route.networkVersion
            ? {
                networkVersion: route.networkVersion,
              }
            : {}),

          ...(current.remainingCoordinates.length >= 2
            ? {
                preferredCoordinates:
                  current.remainingCoordinates,
              }
            : {}),
        },
        controller.signal,
      )

      // Una respuesta cancelada o reemplazada no puede cambiar la simulación.
      if (
        activeRequest !== controller
        || controller.signal.aborted
      ) {
        return
      }

      update({
        explanation: result.explanation,
        toolCalls: result.toolCalls,
      })

      if (result.status === 'not_replanned') {
        update({
          status: 'unavailable',
        })

        return
      }

      if (
        result.route.networkVersion
        !== route.networkVersion
      ) {
        throw new Error(
          'El desvío pertenece a otra red peatonal. No se aplicó.',
        )
      }

      // loadRoute valida la continuidad y conserva los acumulados del robot.
      // Publicamos la alternativa únicamente después de que la haya aceptado.
      dependencies.loadRoute(result.route, true)

      update({
        alternative: result.route,
        status: 'ready',
      })
    } catch (error) {
      if (
        activeRequest === controller
        && !controller.signal.aborted
      ) {
        update({
          status: 'error',
          error: simulationErrorMessage(error),
        })
      }
    } finally {
      // Una petición anterior no puede desbloquear otra más reciente.
      if (activeRequest === controller) {
        activeRequest = null
      }
    }
  }

  return {
    getState: () => state,

    isPending: () => activeRequest !== null,

    request,

    subscribe(listener: () => void) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    clearError() {
      // Puede desaparecer el bloqueo al vencer
      // o quedar fuera del recorrido pendiente.
      update({
        error: '',
        status: state.alternative ? 'ready' : 'idle',
      })
    },

    cancel() {
      if (!activeRequest) return

      const previous = activeRequest
      activeRequest = null

      previous.abort()

      update({
        status: state.alternative ? 'ready' : 'idle',
      })
    },
  }
}