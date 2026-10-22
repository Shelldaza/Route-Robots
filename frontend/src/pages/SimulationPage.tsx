import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useLocation,
} from 'react-router'

import {
  useSimulationMap,
} from '../hooks/useSimulationMap'

import {
  useReplanning,
} from '../hooks/useReplanning'

import {
  useRobotSimulation,
} from '../hooks/useRobotSimulation'

import {
  useScenarioClock,
} from '../hooks/useScenarioClock'

import {
  requestInitialRoute,
  simulationErrorMessage,
} from '../features/simulation/routing-api.ts'

import {
  fetchPedestrianNetwork,
} from '../utils/pedestrian-network'

import {
  calculateRouteEstimates,
  isRobotOperatingProfile,
} from '../utils/route-estimates'

import type {
  RobotOperatingProfile,
} from '../utils/route-estimates'

import type {
  GeographicPoint,
  Bounds,
} from '../../../shared/contracts/geography'

import type {
  RouteResponse,
} from '../../../shared/contracts/routing'

import type {
  PedestrianNetwork,
} from '../../../shared/contracts/pedestrian'

import type {
  IncidentDTO as Incident,
} from '../../../shared/contracts/incidents'

import SimulationIncidentSection from '../components/SimulationIncidentSection'

import {
  SimulationHeader,
  ScenarioControls,
  RobotControls,
  MapLegend,
  RouteMetrics,
  RouteEvaluation,
  SimulationActivity,
} from '../components/simulation/SimulationPanels'

import './DemoPage.css'
import './SimulationPage.css'

type DeliveryDraft = {
  networkVersion?: string
  robot: RobotOperatingProfile & {
    id: string
    name: string
  }
  origin: GeographicPoint
  destination: GeographicPoint
}

function isPoint(
  value: unknown,
): value is GeographicPoint {
  if (!value || typeof value !== 'object') return false

  const point = value as Record<string, unknown>

  return (
    typeof point.lat === 'number'
    && Number.isFinite(point.lat)
    && Math.abs(point.lat) <= 90
    && typeof point.lng === 'number'
    && Number.isFinite(point.lng)
    && Math.abs(point.lng) <= 180
  )
}

// Abrir directamente la URL no debe iniciar una entrega incompleta.
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

// La página conserva la coordinación entre ruta, reloj, robot e incidentes.
// Los paneles reciben datos y acciones sin duplicar estas decisiones.
function SimulationContent({
  navigationState,
}: {
  navigationState: unknown
}) {
  const draft = isDeliveryDraft(navigationState)
    ? navigationState
    : null

  const [simulationId] = useState(
    () => crypto.randomUUID(),
  )

  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [blockedAreas, setBlockedAreas] = useState<Bounds[]>([])
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([])
  const [network, setNetwork] = useState<PedestrianNetwork | null>(null)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [incidentSaving, setIncidentSaving] = useState(false)
  const [selectingLocation, setSelectingLocation] = useState(false)
  const [incidentDraftOpen, setIncidentDraftOpen] = useState(false)

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
        // El editor requiere una red compatible para habilitarse.
      })

    return () => controller.abort()
  }, [draft?.networkVersion])

  const clock = useScenarioClock()

  const motion = useRobotSimulation(
    draft?.robot.speedKmh ?? 0,
  )

  const {
    loadRoute,
    getSnapshot,
  } = motion

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
    request: requestReplanning,
    isPending: isReplanningPending,
  } = replanning

  const hasBlockages = blockedAreas.length > 0
  const displayedRoute = alternative ?? route

  const estimates = draft && displayedRoute
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
    if (!draft) return

    const {
      origin,
      destination,
      networkVersion,
    } = draft

    const controller = new AbortController()

    async function load() {
      setRoute(null)
      setError('')

      try {
        const body = await requestInitialRoute(
          {
            origin,
            destination,
            networkVersion,
          },
          controller.signal,
        )

        if (!controller.signal.aborted) {
          loadRoute(body)
          setRoute(body)
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(simulationErrorMessage(caught))
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [draft, retryKey, loadRoute])

  // El mapa conserva su instancia al cargar una alternativa.
  const {
    containerRef,
    map: incidentMap,
    scrollToMap,
  } = useSimulationMap({
    route,
    alternative,
    network,
    motion,
    activeIncidents,
  })

  function pauseScenarioAndRobot() {
    motion.pause()
    clock.pause()
  }

  function selectIncidentLocation() {
    if (evaluationBusy || isReplanningPending()) return

    pauseScenarioAndRobot()
    setSelectingLocation(true)
    scrollToMap()
  }

  function cancelIncidentSelection() {
    setSelectingLocation(false)
  }

  function changeSimulationSpeed(value: number) {
    motion.setMultiplier(value)
    clock.setMultiplier(value)
  }

  function toggleScenarioClock() {
    if (controlsLocked || isReplanningPending()) return

    if (clock.running) {
      pauseScenarioAndRobot()
    } else {
      clock.start()
    }
  }

  function waitInScenario(seconds: number) {
    if (waitingDisabled || isReplanningPending()) return

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

    // El intervalo transcurre completo aunque el robot llegue antes.
    clock.advanceBy(120)
  }

  function handleBlockedAreasChange(
    areas: Bounds[],
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

    if (!areas.length) {
      replanning.clearError()
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
    setRetryKey((key) => key + 1)
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

  return (
    <div className="demo-page simulation-page">
      <SimulationHeader />

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
                Calculando el recorrido para {draft.robot.name}…
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
                  Robot: <strong>{draft.robot.name}</strong>
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

            <ScenarioControls
              clock={clock}
              controlsLocked={controlsLocked}
              waitingDisabled={waitingDisabled}
              toggleScenarioClock={toggleScenarioClock}
              changeSimulationSpeed={changeSimulationSpeed}
              waitInScenario={waitInScenario}
            />

            <RobotControls
              motion={motion}
              controlsLocked={controlsLocked}
              movementBlocked={movementBlocked}
              traveledEstimates={traveledEstimates}
              toggleMovement={toggleMovement}
              changeSimulationSpeed={changeSimulationSpeed}
              advanceRobotByTwoMinutes={advanceRobotByTwoMinutes}
            />

            {route.networkVersion && (
              <p className="simulation-notice">
                Sandbox peatonal: los recorridos usan la red fija
                de veredas y cruces de OpenStreetMap.
                Las líneas peatonales se muestran al acercar
                el mapa. Las superficies y los controles aparecen
                al ubicar un incidente. Los reportes se colorean
                según su efecto. La cartografía no certifica
                la accesibilidad física del robot.
              </p>
            )}

            <p className="simulation-notice">
              El reloj del escenario puede avanzar con el robot
              detenido o después de llegar al destino.
              Las esperas no suman distancia ni consumo de marcha.
              Al registrar un bloqueo se pausan el robot y el reloj
              para evaluar un desvío desde su posición actual.
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

                <MapLegend
                  motion={motion}
                  alternative={Boolean(alternative)}
                  activeIncidents={activeIncidents}
                />

                <RouteMetrics
                  alternative={Boolean(alternative)}
                  distanceMeters={displayedRoute.distanceMeters}
                  estimates={estimates}
                />
              </section>

              <aside className="simulation-side">
                <RouteEvaluation
                  replanning={replanning}
                  motion={motion}
                  robot={draft.robot}
                  traveledEstimates={traveledEstimates}
                  clock={clock}
                  blockedCount={blockedAreas.length}
                  incidentSaving={incidentSaving}
                />

                <SimulationActivity
                  robotName={draft.robot.name}
                  hasBlockages={hasBlockages}
                  replanning={replanning}
                  motion={motion}
                />
              </aside>
            </div>

            <SimulationIncidentSection
              robotId={draft.robot.id}
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

export default function SimulationPage() {
  const location = useLocation()

  return (
    <SimulationContent
      key={location.key}
      navigationState={location.state}
    />
  )
}