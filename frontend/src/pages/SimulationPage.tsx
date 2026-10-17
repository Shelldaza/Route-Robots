import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'
import blockageIconUrl from '../assets/incidents/blockage.png'
import SimulationIncidentSection from '../components/SimulationIncidentSection'
import type { BlockedArea } from '../components/SimulationIncidentSection'
import './DemoPage.css'
import './SimulationPage.css'
import {
  calculateRouteEstimates,
  isRobotOperatingProfile,
} from '../utils/route-estimates'
import type {
  RobotOperatingProfile,
} from '../utils/route-estimates'

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

  if (!draft.robot || typeof draft.robot !== 'object') return false

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
    result.incidentIds.every((id: unknown) => typeof id === 'string') &&
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
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'La operación tardó demasiado. No se aplicaron cambios en esta pantalla.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}

function SimulationContent({
  navigationState,
}: {
  navigationState: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blockedLayerRef = useRef<L.LayerGroup | null>(null)
  const replanningControllerRef = useRef<AbortController | null>(null)
  const replanningPendingRef = useRef(false)

  const draft = isDeliveryDraft(navigationState)
    ? navigationState
    : null

  const [simulationId] = useState(() => crypto.randomUUID())
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [alternative, setAlternative] = useState<RouteResponse | null>(null)
  const [blockedAreas, setBlockedAreas] = useState<BlockedArea[]>([])
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  const [replanningStatus, setReplanningStatus] =
    useState<ReplanningStatus>('idle')
  const [replanningError, setReplanningError] = useState('')
  const [explanation, setExplanation] = useState('')
  const [toolCalls, setToolCalls] = useState<ToolExecution[]>([])

  const hasBlockages = blockedAreas.length > 0
  const displayedRoute = alternative ?? route
  const estimates =
    draft && displayedRoute
      ? calculateRouteEstimates(
          displayedRoute.distanceMeters,
          draft.robot,
        )
      : null

  useEffect(() => {
    return () => {
      replanningControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!draft) return

    const { origin, destination } = draft
    const controller = new AbortController()

    async function loadRoute() {
      setRoute(null)
      setError('')

      try {
        const response = await fetch('/api/routes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ origin, destination }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
        })

        const body = await readResponse(response)

        if (!isRouteResponse(body)) {
          throw new Error('El servidor devolvió una ruta inválida.')
        }

        if (!controller.signal.aborted) {
          setRoute(body)
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(caught))
        }
      }
    }

    void loadRoute()

    return () => controller.abort()
  }, [draft, retryKey])

  useEffect(() => {
    if (!containerRef.current || !route) return

    const originalPositions: L.LatLngTuple[] =
      route.geometry.coordinates.map(([lng, lat]) => [lat, lng])

    const origin = originalPositions[0]
    const destination = originalPositions[originalPositions.length - 1]

    if (!origin || !destination) return

    const map = L.map(containerRef.current).setView(origin, 15)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    L.polyline(originalPositions, {
      color: alternative ? '#737373' : '#0f766e',
      weight: alternative ? 4 : 5,
      opacity: alternative ? 0.65 : 0.9,
      dashArray: alternative ? '7 8' : undefined,
    })
      .bindTooltip('Ruta original')
      .addTo(map)

    const bounds = L.latLngBounds(originalPositions)

    if (alternative) {
      const alternativePositions: L.LatLngTuple[] =
        alternative.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng],
        )

      const alternativeLine = L.polyline(alternativePositions, {
        color: '#0f766e',
        weight: 6,
        opacity: 0.95,
      })
        .bindTooltip('Alternativa validada')
        .addTo(map)

      bounds.extend(alternativeLine.getBounds())
    }

    L.circleMarker(origin, {
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

    blockedLayerRef.current = L.layerGroup().addTo(map)

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 17,
    })

    return () => {
      blockedLayerRef.current = null
      map.remove()
    }
  }, [route, alternative])

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
        .bindTooltip('Paso bloqueado — incidente simulado', {
          direction: 'top',
        })
        .addTo(layer)
    })
  }, [route, alternative, blockedAreas])

  async function requestReplanning() {
    if (!draft || !route || replanningPendingRef.current) return

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
          origin: draft.origin,
          destination: draft.destination,
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
      if (replanningControllerRef.current === controller) {
        replanningPendingRef.current = false
        replanningControllerRef.current = null
      }
    }
  }

  function handleBlockedAreasChange(areas: BlockedArea[]) {
    setBlockedAreas(areas)

    if (areas.length > 0) {
      void requestReplanning()
    }
  }

  function retryInitialRoute() {
    setError('')
    setRetryKey((current) => current + 1)
  }

  const stateLabel =
    replanningStatus === 'loading'
      ? 'Evaluando desvío…'
      : replanningStatus === 'ready'
        ? 'Alternativa validada'
        : hasBlockages
          ? 'Bloqueo pendiente de resolución'
          : 'Ruta calculada'

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
    route && alternative
      ? alternative.distanceMeters - route.distanceMeters
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
            <img className="demo-brand-robot" src={robotLogo} alt="" />
            <img className="demo-brand-name" src={brandName} alt="" />
          </Link>

          <nav className="demo-nav" aria-label="Principal">
            <Link to="/">Plataforma</Link>
            <Link className="demo-nav-button" to="/demo">
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
              Seleccioná un robot, el origen y el destino para
              continuar a la simulación.
            </p>
            <Link to="/demo">Ir a preparar entrega →</Link>
          </section>
        ) : !route || !displayedRoute ? (
          <section className="simulation-empty" aria-busy={!error}>
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
                Calculando el recorrido para {draft.robot.name}…
              </p>
            )}

            <Link to="/demo">Volver a preparar entrega →</Link>
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
                  Robot: <strong>{draft.robot.name}</strong>
                  {' · '}Washington D. C.
                </p>
              </div>

              <span className="simulation-state" role="status">
                {stateLabel}
              </span>
            </div>

            <div className="simulation-toolbar">
              <div className="simulation-clock">
                <span>Tiempo del escenario</span>
                <strong>Sin iniciar</strong>
              </div>

              <div className="simulation-controls">
                <button type="button" disabled>Iniciar</button>

                <label htmlFor="simulation-speed">
                  Velocidad
                  <select
                    id="simulation-speed"
                    defaultValue="1"
                    disabled
                  >
                    <option value="1">×1</option>
                    <option value="10">×10</option>
                    <option value="60">×60</option>
                  </select>
                </label>

                <button type="button" disabled>+2 minutos</button>
                <button type="button" disabled>+11 días</button>
              </div>
            </div>

            <p className="simulation-notice">
              Al registrar un bloqueo se solicita una evaluación
              mediante IA y MCP. Las alternativas se validan en el
              backend antes de mostrarse. El robot todavía no se mueve.
            </p>

            <div className="simulation-grid">
              <section
                className="simulation-map-panel"
                aria-labelledby="simulation-route-title"
              >
                <div className="simulation-panel-heading">
                  <h2 id="simulation-route-title">
                    {alternative
                      ? 'Ruta original y alternativa'
                      : 'Recorrido original'}
                  </h2>
                  <span>{stateLabel}</span>
                </div>

                <div
                  className="simulation-map"
                  ref={containerRef}
                  aria-label="Mapa del recorrido, los bloqueos y la alternativa"
                />

                <div
                  className="simulation-legend"
                  aria-label="Referencias del mapa"
                >
                  <span>
                    <i className="legend-origin" aria-hidden="true" />
                    Origen
                  </span>
                  <span>
                    <i
                      className="legend-destination"
                      aria-hidden="true"
                    />
                    Destino
                  </span>
                  <span>
                    <i
                      className={
                        alternative ? 'legend-original' : 'legend-route'
                      }
                      aria-hidden="true"
                    />
                    Ruta original
                  </span>

                  {alternative && (
                    <span>
                      <i className="legend-route" aria-hidden="true" />
                      Alternativa
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
        ? 'Distancia alternativa'
        : 'Distancia original'}
    </dt>
    <dd>
      {displayedRoute.distanceMeters.toLocaleString('es-AR', {
        maximumFractionDigits: 1,
      })}{' '}
      m
    </dd>
  </div>

  <div>
    <dt>Tiempo estimado del robot</dt>
    <dd>
      {estimates
        ? `${(estimates.durationSeconds / 60).toLocaleString(
            'es-AR',
            { maximumFractionDigits: 1 },
          )} min`
        : '—'}
    </dd>
  </div>

  <div>
    <dt>Consumo estimado</dt>
    <dd>
      {estimates
        ? `${estimates.consumptionWh.toLocaleString('es-AR', {
            maximumFractionDigits: 1,
          })} Wh`
        : '—'}
    </dd>
  </div>

  <div>
    <dt>Capacidad de batería requerida</dt>
    <dd>
      {estimates
        ? `${estimates.requiredCapacityPercent.toLocaleString(
            'es-AR',
            { maximumFractionDigits: 1 },
          )} %`
        : '—'}
    </dd>
  </div>
</dl>

<p className="simulation-estimates-note">
  Estimaciones a velocidad constante y consumo de referencia.
  No incluyen pendientes, clima ni esperas. El porcentaje expresa
  capacidad requerida, no batería restante.
</p>

{estimates && estimates.requiredCapacityPercent > 100 && (
  <p className="simulation-capacity-warning" role="status">
    El consumo estimado supera la capacidad nominal de batería
    del robot, incluso considerando una carga inicial completa.
  </p>
)}
              </section>

              <aside className="simulation-side">
                <section
                  className="simulation-card"
                  aria-busy={replanningStatus === 'loading'}
                >
                  <p className="simulation-eyebrow">
                    EVALUACIÓN DEL RECORRIDO
                  </p>

                  <h2>{evaluationTitle}</h2>

                  {replanningStatus === 'loading' && (
                    <p role="status">
                      La IA está consultando los incidentes y
                      evaluando el desvío mediante las herramientas MCP.
                    </p>
                  )}

                  {replanningStatus === 'idle' && (
                    <p>
                      Generá un bloqueo para evaluar una alternativa
                      al recorrido original.
                    </p>
                  )}

                  {explanation && (
                    <p className="simulation-ai-explanation">
                      {explanation}
                    </p>
                  )}
                  {explanation && (
                    <p className="simulation-estimates-note">
                      La duración informada por la IA corresponde al perfil
                      peatonal del proveedor. Las métricas del mapa usan la
                      velocidad operativa del robot.
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
                      Diferencia respecto de la ruta original:{' '}
                      <strong>
                        {distanceDifference > 0 ? '+' : ''}
                        {distanceDifference.toLocaleString('es-AR', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        m
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
                      onClick={() => void requestReplanning()}
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
                      <dt>Consumo del recorrido</dt>
                      <dd>
                        {estimates
                          ? `${estimates.consumptionWh.toLocaleString('es-AR', {
                              maximumFractionDigits: 1,
                            })} Wh`
                          : 'No disponible'}
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
                        {alternative ? 'Validada' : 'Sin aplicar'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="simulation-card">
                  <h2>Actividad del sistema</h2>

                  <ol className="simulation-activity">
                    <li>
                      Se recibió el robot {draft.robot.name} junto
                      con el origen y el destino.
                    </li>
                    <li>Se calculó la ruta original.</li>

                    {hasBlockages && (
                      <li>
                        Se registró y ubicó el bloqueo en el mapa.
                      </li>
                    )}

                    {toolCalls.map((tool, index) => (
                      <li key={`${tool.name}-${index}`}>
                        {tool.name === 'consultar_incidentes'
                          ? 'Consulta de incidentes'
                          : tool.name === 'calcular_desvio'
                            ? 'Cálculo del desvío'
                            : 'Ejecución de herramienta'}
                        : {tool.success ? 'completado' : 'sin éxito'}.
                      </li>
                    ))}

                    {alternative && (
                      <li>
                        Se mostró la alternativa validada en el mapa.
                      </li>
                    )}
                  </ol>
                </section>
              </aside>
            </div>

            <SimulationIncidentSection
              simulationId={simulationId}
              coordinates={route.geometry.coordinates}
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