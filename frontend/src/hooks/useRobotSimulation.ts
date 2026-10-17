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
    cancelFrame()

    const path = buildPath(route.geometry.coordinates)
    const current = snapshotRef.current
    const position = samplePath(path, 0)

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
      elapsedSeconds: preserveProgress ? current.elapsedSeconds : 0,
      traveledMeters: preserveProgress ? current.traveledMeters : 0,
      remainingMeters:
        path.lengthMeters === 0 ? 0 : route.distanceMeters,
      position: position.position,
      remainingCoordinates: position.remainingCoordinates,
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

    const sampled = samplePath(path, progress)
    const completed = routeTraveledRef.current >= routeDistanceRef.current

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

      const realSeconds = Math.max(0, (now - previousTime) / 1000)
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

  const getSnapshot = useCallback(() => snapshotRef.current, [])

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