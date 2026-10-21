import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useLocation,
} from 'react-router'

import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  useReplanning,
} from '../hooks/useReplanning'

import {
  requestInitialRoute,
  simulationErrorMessage as getErrorMessage,
} from '../features/simulation/routing-api.ts'

import type {
  GeographicPoint as Point,
  RouteResponse,
} from '../../../shared/contracts/routing'

import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'

import {
  drawPedestrianNetwork,
  fetchPedestrianNetwork,
} from '../utils/pedestrian-network'

import type {
  PedestrianNetwork,
} from '../utils/pedestrian-network'

import SimulationIncidentSection from '../components/SimulationIncidentSection'

import type {
  BlockedArea,
  Incident,
} from '../components/SimulationIncidentSection'

import {
  getIncidentAppearance,
} from '../utils/incident-icons'

import {
  calculateRouteEstimates,
  isRobotOperatingProfile,
} from '../utils/route-estimates'

import type {
  RobotOperatingProfile,
} from '../utils/route-estimates'

import {
  useRobotSimulation,
} from '../hooks/useRobotSimulation'

import {
  useScenarioClock,
} from '../hooks/useScenarioClock'

import './DemoPage.css'
import './SimulationPage.css'

type DeliveryDraft = {
  networkVersion?: string
  robot: RobotOperatingProfile & {
    id: string
    name: string
  }
  origin: Point
  destination: Point
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false

  const point = value as Record<string, unknown>

  return (
    typeof point.lat === 'number'
    && Number.isFinite(point.lat)
    && point.lat >= -90
    && point.lat <= 90
    && typeof point.lng === 'number'
    && Number.isFinite(point.lng)
    && point.lng >= -180
    && point.lng <= 180
  )
}

// El estado de navegación puede faltar al abrir la URL directamente.
// Validarlo evita iniciar una entrega con datos incompletos.
function isDeliveryDraft(
  value: unknown,
): value is DeliveryDraft {
  if (!value || typeof value !== 'object') return false

  const draft = value as Record<string, unknown>

  if (!draft.robot || typeof draft.robot !== 'object') {
    return false
  }

  const robot = draft.robot as Record<string, unknown>

  return (
    typeof robot.id === 'string'
    && robot.id.trim().length > 0
    && typeof robot.name === 'string'
    && robot.name.trim().length > 0
    && isRobotOperatingProfile(robot)
    && (
      draft.networkVersion === undefined
      || typeof draft.networkVersion === 'string'
    )
    && isPoint(draft.origin)
    && isPoint(draft.destination)
  )
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-AR', {
    maximumFractionDigits: 1,
  })
}

// La pantalla coordina el mapa, los controles y las métricas.
// La solicitud de desvíos y sus estados pertenecen a useReplanning.
function SimulationContent({
  navigationState,
}: {
  navigationState: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const savedMapViewRef = useRef<{
    route: RouteResponse
    center: L.LatLng
    zoom: number
  } | null>(null)

  const [incidentMap, setIncidentMap] =
    useState<L.Map | null>(null)

  const [incidentDraftOpen, setIncidentDraftOpen] =
    useState(false)

  // Las referencias permiten conservar objetos de Leaflet entre renders.
  const selectingLocationRef = useRef(false)
  const blockedLayerRef = useRef<L.LayerGroup | null>(null)
  const robotMarkerRef = useRef<L.Marker | null>(null)
  const remainingRouteRef = useRef<L.Polyline | null>(null)
  const originMarkerRef = useRef<L.CircleMarker | null>(null)

  const draft = isDeliveryDraft(navigationState)
    ? navigationState
    : null

  const [simulationId] = useState(
    () => crypto.randomUUID(),
  )

  const [route, setRoute] =
    useState<RouteResponse | null>(null)

  const [blockedAreas, setBlockedAreas] =
    useState<BlockedArea[]>([])

  const [activeIncidents, setActiveIncidents] =
    useState<Incident[]>([])

  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [incidentSaving, setIncidentSaving] = useState(false)
  const [selectingLocation, setSelectingLocation] = useState(false)

  const [network, setNetwork] =
    useState<PedestrianNetwork | null>(null)

  useEffect(() => {
    if (!draft?.networkVersion) return

    const controller = new AbortController()

    void fetchPedestrianNetwork(
      AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(15000),
      ]),
    )
      .then((value) => {
        if (
          !controller.signal.aborted
          && value.version === draft.networkVersion
        ) {
          setNetwork(value)
        }
      })
      .catch(() => {
        // El formulario muestra el estado de red no disponible.
      })

    return () => controller.abort()
  }, [draft?.networkVersion])

  // El escenario puede avanzar con el robot detenido.
  // El tiempo del robot mide únicamente el desplazamiento.
  const clock = useScenarioClock()

  const motion = useRobotSimulation(
    draft?.robot.speedKmh ?? 0,
  )

  const {
    loadRoute,
    getSnapshot,
  } = motion

  // El controlador reúne la petición, los estados y la aplicación del desvío.
  const replanning = useReplanning({
    simulationId,
    route,
    pauseRobot: motion.pause,
    pauseScenario: clock.pause,
    getScenarioTime: clock.getScenarioTime,
    getMotionSnapshot: getSnapshot,
    loadRoute,
  })

  const {
    alternative,
    status: replanningStatus,
    error: replanningError,
    explanation,
    toolCalls,
    comparisonDistance,
    request: requestReplanning,
    isPending: isReplanningPending,
  } = replanning

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
    incidentSaving
    || replanningStatus === 'loading'

  // Editar un incidente mantiene estable la posición y la hora.
  const controlsLocked =
    evaluationBusy
    || selectingLocation
    || incidentDraftOpen

  const movementBlocked =
    controlsLocked
    || (
      hasBlockages
      && replanningStatus !== 'ready'
    )

  const waitingDisabled =
    controlsLocked
    || motion.status === 'running'

  useEffect(() => {
    selectingLocationRef.current =
      selectingLocation && !evaluationBusy
  }, [selectingLocation, evaluationBusy])

  // La ruta inicial tiene su propio ciclo de carga y cancelación.
  useEffect(() => {
    if (!draft) return

    const {
      origin,
      destination,
    } = draft

    const controller = new AbortController()

    async function fetchInitialRoute() {
      setRoute(null)
      setError('')

      try {
        const body = await requestInitialRoute(
          {
            origin,
            destination,
            networkVersion: draft?.networkVersion,
          },
          controller.signal,
        )

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

  // Ciclo de vida de Leaflet. Al reemplazar el recorrido conservamos
  // el encuadre para que la replanificación no aleje el mapa.
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

    const map = L.map(
      containerRef.current,
      {
        maxZoom: 22,
      },
    ).setView(origin, 15)

    mapRef.current = map
    setIncidentMap(map)

    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map)

    remainingRouteRef.current = L.polyline(
      [],
      {
        color: '#0f766e',
        weight: 6,
        opacity: 0.95,

        // El clic atraviesa el recorrido y llega al editor.
        interactive: false,
      },
    ).addTo(map)

    if (!alternative) {
      originMarkerRef.current = L.circleMarker(
        origin,
        {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#15803d',
          fillOpacity: 1,
        },
      )
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

    const currentPosition = getSnapshot().position

    const markerPosition: L.LatLngTuple =
      currentPosition
        ? [
            currentPosition[1],
            currentPosition[0],
          ]
        : origin

    robotMarkerRef.current = L.marker(
      markerPosition,
      {
        icon: robotIcon,
        alt: 'Robot simulado',
        title: 'Robot simulado',
        zIndexOffset: 1000,
      },
    )
      .bindTooltip('Robot simulado')
      .addTo(map)

    blockedLayerRef.current =
      L.layerGroup().addTo(map)

    const savedView = savedMapViewRef.current

    if (savedView?.route === route) {
      map.setView(
        savedView.center,
        savedView.zoom,
      )
    } else {
      map.fitBounds(
        L.latLngBounds(positions),
        {
          padding: [40, 40],
          maxZoom: 17,
        },
      )
    }

    return () => {
      savedMapViewRef.current = {
        route,
        center: map.getCenter(),
        zoom: map.getZoom(),
      }

      mapRef.current = null
      setIncidentMap(null)
      remainingRouteRef.current = null
      originMarkerRef.current = null
      robotMarkerRef.current = null
      blockedLayerRef.current = null

      map.remove()
    }
  }, [route, alternative, getSnapshot])

  useEffect(() => {
    if (!incidentMap || !network) return

    // Los caminos permanecen visibles aunque no estemos editando.
    const layer = drawPedestrianNetwork(
      incidentMap,
      network,
    )

    return () => {
      layer.remove()
    }
  }, [incidentMap, network])

  useEffect(() => {
    // Se actualizan las capas existentes en cada paso de la animación.
    // Reconstruir el mapa por fotograma haría perder el encuadre.
    if (motion.position) {
      const [lng, lat] = motion.position

      robotMarkerRef.current?.setLatLng([
        lat,
        lng,
      ])
    }

    // Al llegar se vacía la línea, aunque el muestreo conserve
    // coordenadas repetidas del destino.
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
      motion.traveledMeters > 0
      || motion.status === 'completed'
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

    // El mapa incluye información y precauciones.
    // Solo los bloqueos generan restricciones sobre el recorrido.
    activeIncidents.forEach((incident) => {
      const appearance = getIncidentAppearance(
        incident.type,
      )

      incident.pedestrianImpact?.segments.forEach(
        (segment) => {
          L.polyline(
            segment.coordinates.map(
              ([lng, lat]): L.LatLngTuple => [
                lat,
                lng,
              ],
            ),
            {
              color:
                incident.effect === 'blockage'
                  ? '#dc2626'
                  : incident.effect === 'caution'
                    ? '#d97706'
                    : '#2563eb',
              weight: 9,
              opacity: 0.8,
              interactive: false,
            },
          ).addTo(layer)
        },
      )

      if (incident.surfaceImpact) {
        L.geoJSON(
          incident.surfaceImpact.geometry,
          {
            style: {
              color:
                incident.effect === 'blockage'
                  ? '#dc2626'
                  : incident.effect === 'caution'
                    ? '#d97706'
                    : '#2563eb',
              weight: 2,
              fillOpacity: 0.3,
            },
            interactive: false,
          },
        ).addTo(layer)
      }

      const area = incident.blockedArea

      const center: L.LatLngTuple = [
        (area.south + area.north) / 2,
        (area.west + area.east) / 2,
      ]

      const icon = L.icon({
        iconUrl: appearance.iconUrl,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        tooltipAnchor: [0, -24],
        className: 'simulation-blockage-icon',
      })

      const effectLabel =
        incident.effect === 'blockage'
          ? 'Paso bloqueado'
          : incident.effect === 'caution'
            ? 'Circular con precaución'
            : 'Información del recorrido'

      // Leaflet interpreta cadenas como HTML.
      // textContent muestra las descripciones como texto literal.
      const tooltip = document.createElement('div')

      const heading = document.createElement('strong')
      heading.textContent = appearance.label

      const effect = document.createElement('div')
      effect.textContent = effectLabel

      const description = document.createElement('div')
      description.textContent = incident.description

      const reporter = document.createElement('div')
      reporter.textContent =
        `Informó: ${incident.reporterName ?? 'Sin identificar'}`

      const expiration = document.createElement('div')
      expiration.textContent =
        `Vigente hasta: ${new Date(incident.expiresAt).toLocaleString('es-AR')}`

      tooltip.append(
        heading,
        effect,
        description,
        reporter,
        expiration,
      )

      L.marker(center, {
        icon,
        alt: appearance.label,
        title: appearance.label,
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(tooltip, {
          direction: 'top',
        })
        .addTo(layer)
    })
  }, [route, alternative, activeIncidents])

  function pauseScenarioAndRobot() {
    motion.pause()
    clock.pause()
  }

  function selectIncidentLocation() {
    if (
      evaluationBusy
      || isReplanningPending()
    ) {
      return
    }

    pauseScenarioAndRobot()
    selectingLocationRef.current = true
    setSelectingLocation(true)

    mapRef.current
      ?.getContainer()
      .scrollIntoView({
        block: 'center',
      })
  }

  function cancelIncidentSelection() {
    selectingLocationRef.current = false
    setSelectingLocation(false)

    // El usuario decide cuándo reanudar el recorrido.
  }

  function changeSimulationSpeed(value: number) {
    motion.setMultiplier(value)
    clock.setMultiplier(value)
  }

  function toggleScenarioClock() {
    if (
      controlsLocked
      || isReplanningPending()
    ) {
      return
    }

    if (clock.running) {
      pauseScenarioAndRobot()
    } else {
      // El escenario puede avanzar sin mover al robot.
      clock.start()
    }
  }

  function waitInScenario(seconds: number) {
    if (
      waitingDisabled
      || isReplanningPending()
    ) {
      return
    }

    motion.pause()
    clock.advanceBy(seconds)
  }

  function advanceRobotByTwoMinutes() {
    if (
      movementBlocked
      || isReplanningPending()
      || motion.status === 'running'
      || motion.status === 'completed'
      || motion.status === 'empty'
    ) {
      return
    }

    pauseScenarioAndRobot()
    motion.advanceBy(120)

    // El escenario avanza el intervalo completo aunque
    // el robot llegue antes al destino.
    clock.advanceBy(120)
  }

  function handleBlockedAreasChange(
    areas: BlockedArea[],
    options: {
      requestReplanning: boolean
    },
  ) {
    setBlockedAreas(areas)

    if (
      options.requestReplanning
      && areas.length > 0
    ) {
      pauseScenarioAndRobot()
      void requestReplanning()
      return
    }

    // Si ya no hay bloqueos sobre el tramo pendiente,
    // se permite continuar aunque la evaluación anterior haya fallado.
    if (areas.length === 0) {
      replanning.clearError()
    }
  }

  function handleCreatingChange(creating: boolean) {
    if (creating) {
      // Bloquea el borrador inmediatamente, antes del próximo render.
      selectingLocationRef.current = false
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
      movementBlocked
      || isReplanningPending()
      || motion.status === 'completed'
      || motion.status === 'empty'
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
      ? 'Registrando incidente…'
      : replanningStatus === 'loading'
        ? 'Evaluando desvío…'
        : selectingLocation
          ? 'Seleccionando ubicación del incidente'
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
                  disabled={controlsLocked}
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
                    disabled={controlsLocked}
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
                    movementBlocked
                    || motion.status === 'completed'
                    || motion.status === 'empty'
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
                    disabled={controlsLocked}
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
                    movementBlocked
                    || motion.status === 'running'
                    || motion.status === 'completed'
                    || motion.status === 'empty'
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

              {motion.status === 'completed'
                && ' · Destino alcanzado'}
            </p>

            {route.networkVersion && (
              <p className="simulation-notice">
                Sandbox peatonal: los recorridos usan la red fija
                de veredas y cruces de OpenStreetMap.
                Las líneas peatonales se muestran al acercar el mapa.
                Las superficies y los controles aparecen al ubicar
                un incidente. Los reportes se colorean según su efecto.
                La cartografía no certifica la accesibilidad física
                del robot.
              </p>
            )}

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
                  aria-label="Mapa del robot, el recorrido y los incidentes"
                />

                <div
                  className="simulation-legend"
                  aria-label="Referencias del mapa"
                >
                  {!alternative
                    && motion.traveledMeters === 0
                    && motion.status !== 'completed' && (
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

                  {[
                    ...new Set(
                      activeIncidents.map(
                        (incident) => incident.type,
                      ),
                    ),
                  ].map((type) => {
                    const appearance =
                      getIncidentAppearance(type)

                    return (
                      <span key={type}>
                        <img
                          className="legend-blockage-image"
                          src={appearance.iconUrl}
                          alt=""
                        />
                        {appearance.label}
                      </span>
                    )
                  })}
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

                {estimates
                  && estimates.requiredCapacityPercent > 100 && (
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

                  {replanningStatus === 'ready'
                    && motion.status === 'paused' && (
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
                    replanningStatus === 'error'
                    || replanningStatus === 'unavailable'
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
                      <dt>Bloqueos sobre el recorrido</dt>
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
                motion.status === 'completed'
                  ? []
                  : motion.remainingCoordinates
              }
              randomReportsDisabled={controlsLocked}
              legacyAreaTestsEnabled={!draft.networkVersion}
              network={network}
              map={incidentMap}
              editorDisabled={evaluationBusy}
              onDraftChange={setIncidentDraftOpen}
              selectingLocation={selectingLocation}
              onSelectLocation={selectIncidentLocation}
              onCancelSelection={cancelIncidentSelection}
              onBeforeCreate={pauseScenarioAndRobot}
              onCreatingChange={handleCreatingChange}
              onBlockedAreasChange={handleBlockedAreasChange}
              onActiveIncidentsChange={setActiveIncidents}
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