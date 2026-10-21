import {
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

import {
  createReplanningController,
} from '../features/simulation/replanning-controller.ts'

import type {
  ReplanningDependencies,
} from '../features/simulation/replanning-controller.ts'

// React se suscribe al controlador.
// La solicitud y sus reglas viven fuera del componente para poder
// probarlas sin montar un mapa ni animar un robot.
export function useReplanning({
  simulationId,
  route,
  pauseRobot,
  pauseScenario,
  getScenarioTime,
  getMotionSnapshot,
  loadRoute,
}: ReplanningDependencies) {
  const controller = useMemo(
    () =>
      createReplanningController({
        simulationId,
        route,
        pauseRobot,
        pauseScenario,
        getScenarioTime,
        getMotionSnapshot,
        loadRoute,
      }),
    [
      simulationId,
      route,
      pauseRobot,
      pauseScenario,
      getScenarioTime,
      getMotionSnapshot,
      loadRoute,
    ],
  )

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )

  // Al salir de la pantalla o cambiar la ruta base,
  // se cancela la solicitud que pertenecía al controlador anterior.
  useEffect(
    () => () => controller.cancel(),
    [controller],
  )

  return {
    ...state,
    request: controller.request,
    clearError: controller.clearError,
    isPending: controller.isPending,
  }
}