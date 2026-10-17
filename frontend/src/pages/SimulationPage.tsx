import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'
import blockageIconUrl from '../assets/incidents/blockage.png'

import SimulationIncidentSection from '../components/SimulationIncidentSection'
import type { BlockedArea } from '../components/SimulationIncidentSection'

import {
  calculateRouteEstimates,
  isRobotOperatingProfile,
} from '../utils/route-estimates'
import type { RobotOperatingProfile } from '../utils/route-estimates'

import { useRobotSimulation } from '../hooks/useRobotSimulation'
import { useScenarioClock } from '../hooks/useScenarioClock'

import './DemoPage.css'
import './SimulationPage.css'

type Point = {
  lat: number
  lng: number
}

type RouteResponse = {
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  distanceMeters: number
  durationSeconds: number
  profile: string
}

type DeliveryDraft = {
  robot: RobotOperatingProfile & {
    id: string
    name: string
  }
  origin: Point
  destination: Point
}

type ToolExecution = {
  name: string
  success: boolean
}

type ReplanningResult = {
  explanation: string
  incidentIds: string[]
  toolCalls: ToolExecution[]
} & (
    | {
      status: 'alternative_ready'
      route: RouteResponse
    }
    | {
      status: 'not_replanned'
      route: null
    }
  )

type ReplanningStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error'

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false

  const point = value as Record<string, unknown>

  return (
    typeof point.lat === 'number' &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180
  )
}

function isDeliveryDraft(value: unknown): value is DeliveryDraft {
  if (!value || typeof value !== 'object') return false

  const draft = value as Record<string, unknown>

  if (!draft.robot || typeof draft.robot !== 'object') {
    return false
  }

  const robot = draft.robot as Record<string, unknown>

  return (
    typeof robot.id === 'string' &&
    robot.id.trim().length > 0 &&
    typeof robot.name === 'string' &&
    robot.name.trim().length > 0 &&
    isRobotOperatingProfile(robot) &&
    isPoint(draft.origin) &&
    isPoint(draft.destination)
  )
}

function isRouteResponse(value: unknown): value is RouteResponse {
  if (!value || typeof value !== 'object') return false

  const route = value as Record<string, unknown>

  if (!route.geometry || typeof route.geometry !== 'object') {
    return false
  }

  const geometry = route.geometry as Record<string, unknown>

  return (
    geometry.type === 'LineString' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    geometry.coordinates.every(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        Number.isFinite(point[0]) &&
        point[0] >= -180 &&
        point[0] <= 180 &&
        typeof point[1] === 'number' &&
        Number.isFinite(point[1]) &&
        point[1] >= -90 &&
        point[1] <= 90,
    ) &&
    typeof route.distanceMeters === 'number' &&
    Number.isFinite(route.distanceMeters) &&
    route.distanceMeters >= 0 &&
    typeof route.durationSeconds === 'number' &&
    Number.isFinite(route.durationSeconds) &&
    route.durationSeconds >= 0 &&
    typeof route.profile === 'string'
  )
}

function isToolExecution(value: unknown): value is ToolExecution {
  if (!value || typeof value !== 'object') return false

  const tool = value as Record<string, unknown>

  return (
    typeof tool.name === 'string' &&
    typeof tool.success === 'boolean'
  )
}

function isReplanningResult(value: unknown): value is ReplanningResult {
  if (!value || typeof value !== 'object') return false

  const result = value as Record<string, unknown>

  return (
    typeof result.explanation === 'string' &&
    result.explanation.trim().length > 0 &&
    Array.isArray(result.incidentIds) &&
    result.incidentIds.every(
      (id: unknown) => typeof id === 'string',
    ) &&
    Array.isArray(result.toolCalls) &&
    result.toolCalls.every(isToolExecution) &&
    (
      (
        result.status === 'alternative_ready' &&
        isRouteResponse(result.route)
      ) ||
      (
        result.status === 'not_replanned' &&
        result.route === null
      )
    )
  )
}

async function readResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : 'No se pudo completar la operación.'

    throw new Error(message)
  }

  return body
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.name === 'TimeoutError'
  ) {
    return 'La operación tardó demasiado. No se aplicaron cambios en esta pantalla.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-AR', {
    maximumFractionDigits: 1,
  })
}

function SimulationContent({
  navigationState,
}: {
  navigationState: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blockedLayerRef = useRef<L.LayerGroup | null>(null)
  const robotMarkerRef = useRef<L.Marker | null>(null)
  const remainingRouteRef = useRef<L.Polyline | null>(null)
  const originMarkerRef = useRef<L.CircleMarker | null>(null)

  const replanningControllerRef =
    useRef<AbortController | null>(null)

  const replanningPendingRef = useRef(false)

  const draft = isDeliveryDraft(navigationState)
    ? navigationState
    : null

  const [simulationId] = useState(
    () => crypto.randomUUID(),
  )

  const [route, setRoute] =
    useState<RouteResponse | null>(null)

  const [alternative, setAlternative] =
    useState<RouteResponse | null>(null)

  const [blockedAreas, setBlockedAreas] =
    useState<BlockedArea[]>([])

  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [incidentSaving, setIncidentSaving] = useState(false)

  const [replanningStatus, setReplanningStatus] =
    useState<ReplanningStatus>('idle')

  const [replanningError, setReplanningError] = useState('')
  const [explanation, setExplanation] = useState('')

  const [toolCalls, setToolCalls] =
    useState<ToolExecution[]>([])

  const [comparisonDistance, setComparisonDistance] =
    useState<number | null>(null)

  const clock = useScenarioClock()

  const motion = useRobotSimulation(
    draft?.robot.speedKmh ?? 0,
  )

  const { loadRoute } = motion

  const hasBlockages = blockedAreas.length > 0
  const displayedRoute = alternative ?? route

  const estimates =
    draft && displayedRoute
      ? calculateRouteEstimates(
        displayedRoute.distanceMeters,
        draft.robot,
      )
      : null

  const traveledEstimates = draft
    ? calculateRouteEstimates(
      motion.traveledMeters,
      draft.robot,
    )
    : null

  const evaluationBusy =
    incidentSaving ||
    replanningStatus === 'loading'

  const movementBlocked =
    evaluationBusy ||
    (hasBlockages && replanningStatus !== 'ready')

  const waitingDisabled =
    evaluationBusy ||
    motion.status === 'running'

  useEffect(() => {
    return () => {
      replanningControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!draft) return

    const { origin, destination } = draft
    const controller = new AbortController()

    async function fetchInitialRoute() {
      setRoute(null)
      setError('')

      try {
        const response = await fetch('/api/routes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin,
            destination,
          }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
        })

        const body = await readResponse(response)

        if (!isRouteResponse(body)) {
          throw new Error(
            'El servidor devolvió una ruta inválida.',
          )
        }

        if (!controller.signal.aborted) {
          loadRoute(body)
          setRoute(body)
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(caught))
        }
      }
    }

    void fetchInitialRoute()

    return () => controller.abort()
  }, [draft, retryKey, loadRoute])

  useEffect(() => {
    if (!containerRef.current || !route) return

    const activeRoute = alternative ?? route

    const positions: L.LatLngTuple[] =
      activeRoute.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng],
      )

    const origin = positions[0]
    const destination = positions[positions.length - 1]

    if (!origin || !destination) return

    const map = L.map(containerRef.current).setView(
      origin,
      15,
    )

    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map)

    remainingRouteRef.current = L.polyline([], {
      color: '#0f766e',
      weight: 6,
      opacity: 0.95,
    })
      .bindTooltip('Recorrido pendiente')
      .addTo(map)

    if (!alternative) {
      originMarkerRef.current = L.circleMarker(origin, {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#15803d',
        fillOpacity: 1,
      })
        .bindTooltip('Origen', {
          permanent: true,
          direction: 'top',
        })
        .addTo(map)
    }

    L.circleMarker(destination, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#2563eb',
      fillOpacity: 1,
    })
      .bindTooltip('Destino', {
        permanent: true,
        direction: 'top',
      })
      .addTo(map)

    const robotIcon = L.icon({
      iconUrl: robotLogo,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: 'simulation-robot-icon',
    })

    robotMarkerRef.current = L.marker(origin, {
      icon: robotIcon,
      alt: 'Robot simulado',
      title: 'Robot simulado',
      zIndexOffset: 1000,
    })
      .bindTooltip('Robot simulado')
      .addTo(map)

    blockedLayerRef.current =
      L.layerGroup().addTo(map)

    map.fitBounds(L.latLngBounds(positions), {
      padding: [40, 40],
      maxZoom: 17,
    })

    return () => {
      remainingRouteRef.current = null
      originMarkerRef.current = null
      robotMarkerRef.current = null
      blockedLayerRef.current = null
      map.remove()
    }
  }, [route, alternative])

  useEffect(() => {
    if (motion.position) {
      const [lng, lat] = motion.position

      robotMarkerRef.current?.setLatLng([lat, lng])
    }

    const remainingPositions: L.LatLngTuple[] =
      motion.status === 'completed'
        ? []
        : motion.remainingCoordinates.map(
          ([lng, lat]) => [lat, lng],
        )

    remainingRouteRef.current?.setLatLngs(
      remainingPositions,
    )

    if (
      motion.traveledMeters > 0 ||
      motion.status === 'completed'
    ) {
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
    }
  }, [
    motion.position,
    motion.remainingCoordinates,
    motion.traveledMeters,
    motion.status,
    route,
    alternative,
  ])

  useEffect(() => {
    const layer = blockedLayerRef.current

    if (!layer) return

    layer.clearLayers()

    const blockageIcon = L.icon({
      iconUrl: blockageIconUrl,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      tooltipAnchor: [0, -26],
      className: 'simulation-blockage-icon',
    })

    blockedAreas.forEach((area) => {
      const center: L.LatLngTuple = [
        (area.south + area.north) / 2,
        (area.west + area.east) / 2,
      ]

      L.marker(center, {
        icon: blockageIcon,
        alt: 'Paso bloqueado',
        title: 'Bloqueo simulado',
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(
          'Paso bloqueado — incidente simulado',
          {
            direction: 'top',
          },
        )
        .addTo(layer)
    })
  }, [route, alternative, blockedAreas])

  function pauseScenarioAndRobot() {
    motion.pause()
    clock.pause()
  }

  function changeSimulationSpeed(value: number) {
    motion.setMultiplier(value)
    clock.setMultiplier(value)
  }

  function toggleScenarioClock() {
    if (
      evaluationBusy ||
      replanningPendingRef.current
    ) {
      return
    }

    if (clock.running) {
      pauseScenarioAndRobot()
    } else {
      // Permite avanzar el escenario sin mover el robot.
      clock.start()
    }
  }

  function waitInScenario(seconds: number) {
    if (
      waitingDisabled ||
      replanningPendingRef.current
    ) {
      return
    }

    motion.pause()
    clock.advanceBy(seconds)
  }

  function advanceRobotByTwoMinutes() {
    if (
      movementBlocked ||
      replanningPendingRef.current ||
      motion.status === 'running' ||
      motion.status === 'completed' ||
      motion.status === 'empty'
    ) {
      return
    }

    pauseScenarioAndRobot()
    motion.advanceBy(120)

    // El escenario avanza el intervalo completo aunque
    // el robot llegue antes al destino.
    clock.advanceBy(120)
  }

  async function requestReplanning() {
    if (
      !draft ||
      !route ||
      replanningPendingRef.current
    ) {
      return
    }

    pauseScenarioAndRobot()

    const scenarioTime = clock.getScenarioTime()
    const current = motion.getSnapshot()

    const origin = current.position
      ? {
        lat: current.position[1],
        lng: current.position[0],
      }
      : draft.origin

    setComparisonDistance(current.remainingMeters)

    const controller = new AbortController()

    replanningControllerRef.current = controller
    replanningPendingRef.current = true

    setReplanningStatus('loading')
    setReplanningError('')
    setExplanation('')
    setToolCalls([])

    try {
      const response = await fetch('/api/replanning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulationId,
          origin,
          destination: draft.destination,
          scenarioTime,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(120000),
        ]),
      })

      const body = await readResponse(response)

      if (!isReplanningResult(body)) {
        throw new Error(
          'El servidor devolvió una evaluación con datos inválidos.',
        )
      }

      if (controller.signal.aborted) return

      setExplanation(body.explanation)
      setToolCalls(body.toolCalls)

      if (body.status === 'alternative_ready') {
        loadRoute(body.route, true)
        setAlternative(body.route)
        setReplanningStatus('ready')
      } else {
        setReplanningStatus('unavailable')
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setReplanningError(getErrorMessage(caught))
        setReplanningStatus('error')
      }
    } finally {
      if (
        replanningControllerRef.current === controller
      ) {
        replanningPendingRef.current = false
        replanningControllerRef.current = null
      }
    }
  }

  function handleBlockedAreasChange(
    areas: BlockedArea[],
    options: {
      requestReplanning: boolean
    },
  ) {
    setBlockedAreas(areas)

    if (
      options.requestReplanning &&
      areas.length > 0
    ) {
      pauseScenarioAndRobot()
      void requestReplanning()
      return
    }

    // Si finalizaron todos los bloqueos, permite continuar
    // incluso si la evaluación anterior había fallado.
    if (areas.length === 0) {
      setReplanningError('')
      setReplanningStatus(
        alternative ? 'ready' : 'idle',
      )
    }
  }
  function handleCreatingChange(creating: boolean) {
    if (creating) {
      pauseScenarioAndRobot()
    }

    setIncidentSaving(creating)
  }

  function retryInitialRoute() {
    setError('')
    setRetryKey((current) => current + 1)
  }

  function toggleMovement() {
    if (
      movementBlocked ||
      replanningPendingRef.current ||
      motion.status === 'completed' ||
      motion.status === 'empty'
    ) {
      return
    }

    if (motion.status === 'running') {
      pauseScenarioAndRobot()
    } else {
      clock.start()
      motion.start()
    }
  }

  const stateLabel =
    incidentSaving
      ? 'Registrando bloqueo…'
      : replanningStatus === 'loading'
        ? 'Evaluando desvío…'
        : motion.status === 'completed'
          ? 'Destino alcanzado'
          : hasBlockages && replanningStatus !== 'ready'
            ? 'Bloqueo pendiente de resolución'
            : motion.status === 'running'
              ? 'En recorrido'
              : motion.status === 'paused'
                ? 'Recorrido pausado'
                : 'Listo para iniciar'

  const evaluationTitle =
    replanningStatus === 'loading'
      ? 'Buscando una alternativa'
      : replanningStatus === 'ready'
        ? 'Alternativa disponible'
        : replanningStatus === 'unavailable'
          ? 'Sin alternativa validada'
          : replanningStatus === 'error'
            ? 'No se completó la evaluación'
            : 'Evaluación pendiente'

  const distanceDifference =
    comparisonDistance !== null && alternative
      ? alternative.distanceMeters - comparisonDistance
      : null

  return (
    <div className="demo-page simulation-page">
      <header className="demo-header">
        <div className="demo-nav-wrap">
          <Link
            className="demo-brand"
            to="/"
            aria-label="RouteRobots — Inicio"
          >
            <img
              className="demo-brand-robot"
              src={robotLogo}
              alt=""
            />
            <img
              className="demo-brand-name"
              src={brandName}
              alt=""
            />
          </Link>

          <nav
            className="demo-nav"
            aria-label="Principal"
          >
            <Link to="/">Plataforma</Link>

            <Link
              className="demo-nav-button"
              to="/demo"
            >
              Configurar otra entrega
              <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="simulation-workspace">
        {!draft ? (
          <section className="simulation-empty">
            <h1>Primero prepará una entrega</h1>
            <p>
              Seleccioná un robot, el origen y el destino
              para continuar a la simulación.
            </p>
            <Link to="/demo">
              Ir a preparar entrega →
            </Link>
          </section>
        ) : !route || !displayedRoute ? (
          <section
            className="simulation-empty"
            aria-busy={!error}
          >
            <h1>
              {error
                ? 'No pudimos preparar la ruta'
                : 'Preparando recorrido'}
            </h1>

            {error ? (
              <>
                <p role="alert">{error}</p>

                <button
                  className="simulation-retry"
                  type="button"
                  onClick={retryInitialRoute}
                >
                  Reintentar cálculo
                </button>
              </>
            ) : (
              <p role="status">
                Calculando el recorrido para{' '}
                {draft.robot.name}…
              </p>
            )}

            <Link to="/demo">
              Volver a preparar entrega →
            </Link>
          </section>
        ) : (
          <>
            <div className="simulation-heading">
              <div>
                <p className="simulation-eyebrow">
                  SEGUIMIENTO DE ENTREGA
                </p>

                <h1>El recorrido y sus decisiones</h1>

                <p>
                  Robot:{' '}
                  <strong>{draft.robot.name}</strong>
                  {' · '}Washington D. C.
                </p>
              </div>

              <span
                className="simulation-state"
                role="status"
              >
                {stateLabel}
              </span>
            </div>

            <div className="simulation-toolbar">
              <div className="simulation-clock">
                <span>Fecha y hora del escenario</span>

                <strong>
                  {new Date(
                    clock.nowMs,
                  ).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </strong>
              </div>

              <div className="simulation-controls">
                <button
                  type="button"
                  onClick={toggleScenarioClock}
                  disabled={evaluationBusy}
                >
                  {clock.running
                    ? 'Pausar escenario'
                    : 'Avanzar escenario'}
                </button>

                <label htmlFor="scenario-speed">
                  Velocidad del reloj

                  <select
                    id="scenario-speed"
                    value={clock.multiplier}
                    onChange={(event) =>
                      changeSimulationSpeed(
                        Number(event.target.value),
                      )
                    }
                    disabled={evaluationBusy}
                  >
                    <option value="1">×1</option>
                    <option value="10">×10</option>
                    <option value="60">×60</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => waitInScenario(120)}
                  disabled={waitingDisabled}
                >
                  Esperar 2 minutos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    waitInScenario(24 * 60 * 60)
                  }
                  disabled={waitingDisabled}
                >
                  Esperar 1 día
                </button>

                <button
                  type="button"
                  onClick={() =>
                    waitInScenario(11 * 24 * 60 * 60)
                  }
                  disabled={waitingDisabled}
                >
                  Esperar 11 días
                </button>
              </div>
            </div>

            <div className="simulation-toolbar">
              <div className="simulation-clock">
                <span>Tiempo simulado de marcha</span>

                <strong>
                  {formatNumber(
                    motion.elapsedSeconds / 60,
                  )}{' '}
                  min
                </strong>
              </div>

              <div className="simulation-controls">
                <button
                  type="button"
                  onClick={toggleMovement}
                  disabled={
                    movementBlocked ||
                    motion.status === 'completed' ||
                    motion.status === 'empty'
                  }
                >
                  {motion.status === 'completed'
                    ? 'Recorrido finalizado'
                    : motion.status === 'running'
                      ? 'Pausar recorrido'
                      : motion.elapsedSeconds > 0
                        ? 'Reanudar recorrido'
                        : 'Iniciar recorrido'}
                </button>

                <label htmlFor="simulation-speed">
                  Velocidad de simulación

                  <select
                    id="simulation-speed"
                    value={motion.multiplier}
                    onChange={(event) =>
                      changeSimulationSpeed(
                        Number(event.target.value),
                      )
                    }
                    disabled={evaluationBusy}
                  >
                    <option value="1">×1</option>
                    <option value="10">×10</option>
                    <option value="60">×60</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={advanceRobotByTwoMinutes}
                  disabled={
                    movementBlocked ||
                    motion.status === 'running' ||
                    motion.status === 'completed' ||
                    motion.status === 'empty'
                  }
                >
                  Recorrer 2 minutos
                </button>
              </div>
            </div>

            <p className="simulation-progress">
              Recorrido:{' '}
              <strong>
                {formatNumber(motion.traveledMeters)} m
              </strong>
              {' · '}Pendiente:{' '}
              <strong>
                {formatNumber(motion.remainingMeters)} m
              </strong>

              {traveledEstimates && (
                <>
                  {' · '}Consumo acumulado estimado:{' '}
                  <strong>
                    {formatNumber(
                      traveledEstimates.consumptionWh,
                    )}{' '}
                    Wh
                  </strong>
                </>
              )}

              {motion.status === 'completed' &&
                ' · Destino alcanzado'}
            </p>

            <p className="simulation-notice">
              El reloj del escenario puede avanzar con el
              robot detenido o después de llegar al destino.
              Las esperas no suman distancia ni consumo de
              marcha. Al registrar un bloqueo se pausan el
              robot y el reloj para evaluar un desvío desde
              su posición actual.
            </p>

            <div className="simulation-grid">
              <section
                className="simulation-map-panel"
                aria-labelledby="simulation-route-title"
              >
                <div className="simulation-panel-heading">
                  <h2 id="simulation-route-title">
                    {motion.status === 'completed'
                      ? 'Destino alcanzado'
                      : alternative
                        ? 'Desvío pendiente'
                        : 'Recorrido pendiente'}
                  </h2>

                  <span>{stateLabel}</span>
                </div>

                <div
                  className="simulation-map"
                  ref={containerRef}
                  aria-label="Mapa del robot, el recorrido y los bloqueos"
                />

                <div
                  className="simulation-legend"
                  aria-label="Referencias del mapa"
                >
                  {!alternative &&
                    motion.traveledMeters === 0 &&
                    motion.status !== 'completed' && (
                      <span>
                        <i
                          className="legend-origin"
                          aria-hidden="true"
                        />
                        Origen
                      </span>
                    )}

                  <span>
                    <i
                      className="legend-destination"
                      aria-hidden="true"
                    />
                    Destino
                  </span>

                  <span>
                    <img
                      className="legend-blockage-image"
                      src={robotLogo}
                      alt=""
                    />
                    Robot
                  </span>

                  {motion.status !== 'completed' && (
                    <span>
                      <i
                        className="legend-route"
                        aria-hidden="true"
                      />
                      {alternative
                        ? 'Desvío pendiente'
                        : 'Recorrido pendiente'}
                    </span>
                  )}

                  {hasBlockages && (
                    <span>
                      <img
                        className="legend-blockage-image"
                        src={blockageIconUrl}
                        alt=""
                      />
                      Bloqueo simulado
                    </span>
                  )}
                </div>

                <dl className="simulation-metrics">
                  <div>
                    <dt>
                      {alternative
                        ? 'Distancia del desvío'
                        : 'Distancia original'}
                    </dt>

                    <dd>
                      {formatNumber(
                        displayedRoute.distanceMeters,
                      )}{' '}
                      m
                    </dd>
                  </div>

                  <div>
                    <dt>
                      {alternative
                        ? 'Tiempo estimado del desvío'
                        : 'Tiempo estimado del robot'}
                    </dt>

                    <dd>
                      {estimates
                        ? `${formatNumber(
                          estimates.durationSeconds / 60,
                        )} min`
                        : '—'}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      {alternative
                        ? 'Consumo estimado del desvío'
                        : 'Consumo estimado del recorrido'}
                    </dt>

                    <dd>
                      {estimates
                        ? `${formatNumber(
                          estimates.consumptionWh,
                        )} Wh`
                        : '—'}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Capacidad de batería requerida
                    </dt>

                    <dd>
                      {estimates
                        ? `${formatNumber(
                          estimates.requiredCapacityPercent,
                        )} %`
                        : '—'}
                    </dd>
                  </div>
                </dl>

                <p className="simulation-estimates-note">
                  Estimaciones a velocidad constante y
                  consumo de referencia, sin pendientes,
                  clima ni consumo durante las esperas.
                  {alternative
                    ? ' Las métricas corresponden al desvío desde el punto donde se pausó el robot.'
                    : ' Las métricas corresponden al recorrido original completo.'}
                  {' '}El porcentaje expresa capacidad
                  requerida, no batería restante.
                </p>

                {estimates &&
                  estimates.requiredCapacityPercent > 100 && (
                    <p
                      className="simulation-capacity-warning"
                      role="status"
                    >
                      El consumo estimado del recorrido
                      mostrado supera la capacidad nominal
                      de batería del robot.
                    </p>
                  )}
              </section>

              <aside className="simulation-side">
                <section
                  className="simulation-card"
                  aria-busy={
                    replanningStatus === 'loading'
                  }
                >
                  <p className="simulation-eyebrow">
                    EVALUACIÓN DEL RECORRIDO
                  </p>

                  <h2>{evaluationTitle}</h2>

                  {replanningStatus === 'loading' && (
                    <p role="status">
                      El robot y el reloj están pausados.
                      La IA está consultando los incidentes
                      y evaluando un desvío mediante MCP.
                    </p>
                  )}

                  {replanningStatus === 'idle' && (
                    <p>
                      Podés iniciar el recorrido y generar
                      un bloqueo por delante del robot para
                      evaluar un desvío.
                    </p>
                  )}

                  {explanation && (
                    <>
                      <p className="simulation-ai-explanation">
                        {explanation}
                      </p>

                      <p className="simulation-estimates-note">
                        La duración del proveedor corresponde
                        al perfil peatonal. Las métricas del
                        mapa utilizan la velocidad operativa
                        del robot.
                      </p>
                    </>
                  )}

                  {replanningStatus === 'ready' &&
                    motion.status === 'paused' && (
                      <p className="simulation-route-comparison">
                        El desvío está cargado. Pulsá
                        Reanudar recorrido para continuar;
                        si todavía no habías iniciado,
                        pulsá Iniciar recorrido.
                      </p>
                    )}

                  {replanningError && (
                    <p
                      className="simulation-incident-error"
                      role="alert"
                    >
                      {replanningError}
                    </p>
                  )}

                  {distanceDifference !== null && (
                    <p className="simulation-route-comparison">
                      Diferencia respecto del recorrido
                      pendiente:{' '}
                      <strong>
                        {distanceDifference > 0 ? '+' : ''}
                        {formatNumber(distanceDifference)} m
                      </strong>.
                    </p>
                  )}

                  {(
                    replanningStatus === 'error' ||
                    replanningStatus === 'unavailable'
                  ) && (
                      <button
                        className="simulation-retry"
                        type="button"
                        onClick={() =>
                          void requestReplanning()
                        }
                        disabled={incidentSaving}
                      >
                        Reintentar evaluación
                      </button>
                    )}

                  <dl className="simulation-checks">
                    <div>
                      <dt>Robot</dt>
                      <dd>{draft.robot.name}</dd>
                    </div>

                    <div>
                      <dt>Velocidad operativa</dt>
                      <dd>
                        {formatNumber(
                          draft.robot.speedKmh,
                        )}{' '}
                        km/h
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Consumo acumulado estimado
                      </dt>
                      <dd>
                        {traveledEstimates
                          ? `${formatNumber(
                            traveledEstimates.consumptionWh,
                          )} Wh`
                          : 'No disponible'}
                      </dd>
                    </div>

                    <div>
                      <dt>Reloj del escenario</dt>
                      <dd>
                        {clock.running
                          ? 'Avanzando'
                          : 'Pausado'}
                      </dd>
                    </div>

                    <div>
                      <dt>Pendientes</dt>
                      <dd>Sin verificar</dd>
                    </div>

                    <div>
                      <dt>Bloqueos registrados</dt>
                      <dd>{blockedAreas.length}</dd>
                    </div>

                    <div>
                      <dt>Alternativa</dt>
                      <dd>
                        {alternative
                          ? 'Cargada en el escenario'
                          : 'Sin cargar'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="simulation-card">
                  <h2>Actividad del sistema</h2>

                  <ol className="simulation-activity">
                    <li>
                      Se recibió el robot{' '}
                      {draft.robot.name} junto con el
                      origen y el destino.
                    </li>

                    <li>
                      Se calculó la ruta original.
                    </li>

                    {hasBlockages && (
                      <li>
                        Se registró el bloqueo y se
                        pausó el recorrido.
                      </li>
                    )}

                    {toolCalls.map((tool, index) => (
                      <li
                        key={`${tool.name}-${index}`}
                      >
                        {tool.name === 'consultar_incidentes'
                          ? 'Consulta de incidentes'
                          : tool.name === 'calcular_desvio'
                            ? 'Cálculo del desvío'
                            : 'Ejecución de herramienta'}
                        :{' '}
                        {tool.success
                          ? 'completado'
                          : 'sin éxito'}.
                      </li>
                    ))}

                    {alternative && (
                      <li>
                        Se cargó una alternativa desde
                        la posición donde se pausó el
                        robot.
                      </li>
                    )}

                    {motion.status === 'completed' && (
                      <li>
                        El robot alcanzó el destino.
                        El reloj del escenario puede
                        continuar avanzando.
                      </li>
                    )}
                  </ol>
                </section>
              </aside>
            </div>

            <SimulationIncidentSection
              simulationId={simulationId}
              scenarioTime={clock.scenarioTime}
              getScenarioTime={clock.getScenarioTime}
              coordinates={
                motion.remainingCoordinates.length >= 2
                  ? motion.remainingCoordinates
                  : route.geometry.coordinates
              }
              onBeforeCreate={pauseScenarioAndRobot}
              onCreatingChange={handleCreatingChange}
              onBlockedAreasChange={handleBlockedAreasChange}
            />
          </>
        )}
      </main>
    </div>
  )
}

function SimulationPage() {
  const location = useLocation()

  return (
    <SimulationContent
      key={location.key}
      navigationState={location.state}
    />
  )
}

export default SimulationPage