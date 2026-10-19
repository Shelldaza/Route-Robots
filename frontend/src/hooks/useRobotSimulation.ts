import { useCallback, useEffect, useRef, useState } from 'react'
import { buildPath, samplePath } from '../utils/simulation-path'
import type {
  Coordinate,
  SimulationPath,
} from '../utils/simulation-path'

type SimulationStatus =
  | 'empty'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'

type SimulationRoute = {
  geometry: {
    coordinates: Coordinate[]
  }
  distanceMeters: number
}

type Snapshot = {
  status: SimulationStatus
  elapsedSeconds: number
  traveledMeters: number
  remainingMeters: number
  position: Coordinate | null
  remainingCoordinates: Coordinate[]
}

// Tolerancia para pequeñas diferencias de precisión entre coordenadas.
// No permite conectar calles distintas mediante un segmento artificial.
const MAX_START_GAP_METERS = 1

const initialSnapshot: Snapshot = {
  status: 'empty',
  elapsedSeconds: 0,
  traveledMeters: 0,
  remainingMeters: 0,
  position: null,
  remainingCoordinates: [],
}

export function useRobotSimulation(speedKmh: number) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [multiplier, setMultiplierState] = useState(1)

  const snapshotRef = useRef(initialSnapshot)
  const pathRef = useRef<SimulationPath | null>(null)
  const routeDistanceRef = useRef(0)
  const routeTraveledRef = useRef(0)
  const multiplierRef = useRef(1)
  const frameRef = useRef<number | null>(null)

  const publish = useCallback((next: Snapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
  }, [])

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  useEffect(() => cancelFrame, [cancelFrame])

  const pause = useCallback(() => {
    cancelFrame()

    const current = snapshotRef.current

    if (current.status === 'running') {
      publish({
        ...current,
        status: 'paused',
      })
    }
  }, [cancelFrame, publish])

  const loadRoute = useCallback((
    route: SimulationRoute,
    preserveProgress = false,
  ) => {
    if (
      !Number.isFinite(route.distanceMeters) ||
      route.distanceMeters < 0
    ) {
      throw new Error('La ruta tiene una distancia inválida.')
    }

    const current = snapshotRef.current
    let coordinates = route.geometry.coordinates

    if (preserveProgress) {
      const currentPosition = current.position
      const first = coordinates[0]

      if (!currentPosition || !first) {
        throw new Error(
          'No se pudo comprobar el inicio del desvío.',
        )
      }

      // El proveedor puede ajustar el origen a otro camino.
      // Conservar los acumulados no alcanza: también necesitamos
      // comprobar que el recorrido empiece donde está el robot.
      const gapMeters = buildPath([
        currentPosition,
        first,
      ]).lengthMeters

      if (
        !Number.isFinite(gapMeters) ||
        gapMeters > MAX_START_GAP_METERS
      ) {
        console.warn(
          'Desvío descartado por falta de continuidad:',
          {
            currentPosition,
            routeStart: first,
            gapMeters,
          },
        )

        throw new Error(
          `El desvío comienza a ${gapMeters.toFixed(1)} m del robot. ` +
          'No se aplicó porque no conecta con su posición actual.',
        )
      }

      // Solo corregimos diferencias dentro de la tolerancia.
      // La copia evita modificar la respuesta recibida del backend.
      coordinates = [
        [currentPosition[0], currentPosition[1]],
        ...coordinates.slice(1),
      ]
    }

    const path = buildPath(coordinates)
    const sampled = samplePath(path, 0)

    if (!sampled.position) {
      throw new Error(
        'La ruta no contiene un recorrido válido.',
      )
    }

    // La ruta anterior no se reemplaza hasta terminar la validación.
    // Si el desvío se rechaza, se conservan la posición y el progreso.
    cancelFrame()

    pathRef.current = path
    routeDistanceRef.current = route.distanceMeters
    routeTraveledRef.current = 0

    publish({
      status:
        route.distanceMeters <= 0 || path.lengthMeters === 0
          ? 'completed'
          : preserveProgress
            ? 'paused'
            : 'ready',
      elapsedSeconds:
        preserveProgress ? current.elapsedSeconds : 0,
      traveledMeters:
        preserveProgress ? current.traveledMeters : 0,
      remainingMeters:
        path.lengthMeters === 0 ? 0 : route.distanceMeters,
      position: sampled.position,
      remainingCoordinates: sampled.remainingCoordinates,
    })
  }, [cancelFrame, publish])

  const advance = useCallback((seconds: number) => {
    const path = pathRef.current
    const current = snapshotRef.current
    const metersPerSecond = speedKmh / 3.6

    if (
      !path ||
      current.status === 'completed' ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      !Number.isFinite(metersPerSecond) ||
      metersPerSecond <= 0
    ) {
      return
    }

    const remaining = Math.max(
      0,
      routeDistanceRef.current - routeTraveledRef.current,
    )

    const traveled = Math.min(
      remaining,
      metersPerSecond * seconds,
    )

    routeTraveledRef.current += traveled

    const progress =
      routeDistanceRef.current > 0
        ? routeTraveledRef.current / routeDistanceRef.current
        : 1

    // Seguimos el orden de las coordenadas, incluso cuando
    // el desvío exige retroceder por una calle ya recorrida.
    const sampled = samplePath(path, progress)

    const completed =
      routeTraveledRef.current >= routeDistanceRef.current

    publish({
      status: completed ? 'completed' : current.status,
      elapsedSeconds:
        current.elapsedSeconds + traveled / metersPerSecond,
      traveledMeters: current.traveledMeters + traveled,
      remainingMeters: Math.max(0, remaining - traveled),
      position: sampled.position,
      remainingCoordinates: sampled.remainingCoordinates,
    })
  }, [speedKmh, publish])

  const start = useCallback(() => {
    const current = snapshotRef.current

    if (
      current.status !== 'ready' &&
      current.status !== 'paused'
    ) {
      return
    }

    if (!Number.isFinite(speedKmh) || speedKmh <= 0) return

    publish({
      ...current,
      status: 'running',
    })

    let previousTime = performance.now()

    function frame(now: number) {
      if (snapshotRef.current.status !== 'running') return

      const realSeconds = Math.max(
        0,
        (now - previousTime) / 1000,
      )

      previousTime = now

      advance(realSeconds * multiplierRef.current)

      if (snapshotRef.current.status === 'running') {
        frameRef.current = requestAnimationFrame(frame)
      } else {
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(frame)
  }, [speedKmh, advance, publish])

  const advanceBy = useCallback((seconds: number) => {
    pause()
    advance(seconds)
  }, [pause, advance])

  const setMultiplier = useCallback((value: number) => {
    if (![1, 10, 60].includes(value)) return

    multiplierRef.current = value
    setMultiplierState(value)
  }, [])

  const getSnapshot = useCallback(
    () => snapshotRef.current,
    [],
  )

  return {
    ...snapshot,
    multiplier,
    start,
    pause,
    advanceBy,
    setMultiplier,
    loadRoute,
    getSnapshot,
  }
}