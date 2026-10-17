import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const ALLOWED_MULTIPLIERS = [1, 10, 60]

export function useScenarioClock() {
  const [initialTime] = useState(() => Date.now())
  const [nowMs, setNowMs] = useState(initialTime)
  const [running, setRunning] = useState(false)
  const [multiplier, setMultiplierState] = useState(1)

  const nowRef = useRef(initialTime)
  const runningRef = useRef(false)
  const multiplierRef = useRef(1)
  const previousTimeRef = useRef<number | null>(null)
  const intervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null)

  const publish = useCallback((value: number) => {
    nowRef.current = value
    setNowMs(value)
  }, [])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    if (!runningRef.current) return

    const currentTime = performance.now()
    const previousTime = previousTimeRef.current

    previousTimeRef.current = currentTime

    if (previousTime === null) return

    const elapsedMs = Math.max(
      0,
      currentTime - previousTime,
    )

    publish(
      nowRef.current
        + elapsedMs * multiplierRef.current,
    )
  }, [publish])

  const start = useCallback(() => {
    if (runningRef.current) return

    runningRef.current = true
    previousTimeRef.current = performance.now()
    setRunning(true)

    intervalRef.current = setInterval(tick, 250)
  }, [tick])

  const pause = useCallback(() => {
    // Incluye el tiempo transcurrido desde el último tick.
    tick()

    runningRef.current = false
    previousTimeRef.current = null
    clearTimer()
    setRunning(false)
  }, [tick, clearTimer])

  const advanceBy = useCallback((seconds: number) => {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      return
    }

    pause()

    const nextTime = nowRef.current + seconds * 1000

    if (!Number.isFinite(new Date(nextTime).getTime())) {
      return
    }

    publish(nextTime)
  }, [pause, publish])

  const setMultiplier = useCallback((value: number) => {
    if (!ALLOWED_MULTIPLIERS.includes(value)) return

    // Contabiliza el intervalo anterior con su velocidad.
    tick()

    multiplierRef.current = value
    setMultiplierState(value)
  }, [tick])

  const getScenarioTime = useCallback(
    () => new Date(nowRef.current).toISOString(),
    [],
  )

  useEffect(() => {
    return () => {
      runningRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  return {
    nowMs,
    scenarioTime: new Date(nowMs).toISOString(),
    running,
    multiplier,
    start,
    pause,
    advanceBy,
    setMultiplier,
    getScenarioTime,
  }
}