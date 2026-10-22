import { Link } from 'react-router'

import robotLogo from '../../assets/robot-logo.jpg'
import brandName from '../../assets/routerobots-name.jpg'

import type {
  IncidentDTO as Incident,
} from '../../../../shared/contracts/incidents'

import type {
  RouteEstimates,
  RobotOperatingProfile,
} from '../../utils/route-estimates'

import type {
  useRobotSimulation,
} from '../../hooks/useRobotSimulation'

import type {
  useScenarioClock,
} from '../../hooks/useScenarioClock'

import type {
  useReplanning,
} from '../../hooks/useReplanning'

import {
  getIncidentAppearance,
} from '../../utils/incident-icons'

type Motion = ReturnType<typeof useRobotSimulation>
type Clock = ReturnType<typeof useScenarioClock>
type Evaluation = ReturnType<typeof useReplanning>

const formatNumber = (value: number) =>
  value.toLocaleString('es-AR', {
    maximumFractionDigits: 1,
  })

// Los paneles muestran datos y emiten acciones.
// La página decide cuándo se permite avanzar, pausar o evaluar.
export function SimulationHeader() {
  return (
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

        <nav className="demo-nav" aria-label="Principal">
          <Link to="/">Plataforma</Link>

          <Link className="demo-nav-button" to="/demo">
            Configurar otra entrega
            <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

type ScenarioProps = {
  clock: Clock
  controlsLocked: boolean
  waitingDisabled: boolean
  toggleScenarioClock: () => void
  changeSimulationSpeed: (value: number) => void
  waitInScenario: (seconds: number) => void
}

export function ScenarioControls({
  clock,
  controlsLocked,
  waitingDisabled,
  toggleScenarioClock,
  changeSimulationSpeed,
  waitInScenario,
}: ScenarioProps) {
  return (
    <div className="simulation-toolbar">
      <div className="simulation-clock">
        <span>Fecha y hora del escenario</span>

        <strong>
          {new Date(clock.nowMs).toLocaleString('es-AR', {
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
            disabled={controlsLocked}
            onChange={(event) =>
              changeSimulationSpeed(
                Number(event.target.value),
              )
            }
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
          onClick={() => waitInScenario(24 * 60 * 60)}
          disabled={waitingDisabled}
        >
          Esperar 1 día
        </button>

        <button
          type="button"
          onClick={() => waitInScenario(11 * 24 * 60 * 60)}
          disabled={waitingDisabled}
        >
          Esperar 11 días
        </button>
      </div>
    </div>
  )
}

type RobotProps = {
  motion: Motion
  controlsLocked: boolean
  movementBlocked: boolean
  traveledEstimates: RouteEstimates | null
  toggleMovement: () => void
  changeSimulationSpeed: (value: number) => void
  advanceRobotByTwoMinutes: () => void
}

export function RobotControls({
  motion,
  controlsLocked,
  movementBlocked,
  traveledEstimates,
  toggleMovement,
  changeSimulationSpeed,
  advanceRobotByTwoMinutes,
}: RobotProps) {
  return (
    <>
      <div className="simulation-toolbar">
        <div className="simulation-clock">
          <span>Tiempo simulado de marcha</span>
          <strong>
            {formatNumber(motion.elapsedSeconds / 60)} min
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
              disabled={controlsLocked}
              onChange={(event) =>
                changeSimulationSpeed(
                  Number(event.target.value),
                )
              }
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
              )} Wh
            </strong>
          </>
        )}

        {motion.status === 'completed'
          && ' · Destino alcanzado'}
      </p>
    </>
  )
}

export function MapLegend({
  motion,
  alternative,
  activeIncidents,
}: {
  motion: Motion
  alternative: boolean
  activeIncidents: Incident[]
}) {
  return (
    <div
      className="simulation-legend"
      aria-label="Referencias del mapa"
    >
      {!alternative
        && motion.traveledMeters === 0
        && motion.status !== 'completed' && (
          <span>
            <i className="legend-origin" aria-hidden="true" />
            Origen
          </span>
        )}

      <span>
        <i className="legend-destination" aria-hidden="true" />
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
          <i className="legend-route" aria-hidden="true" />
          {alternative
            ? 'Desvío pendiente'
            : 'Recorrido pendiente'}
        </span>
      )}

      {[...new Set(
        activeIncidents.map((item) => item.type),
      )].map((type) => {
        const appearance = getIncidentAppearance(type)

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
  )
}

export function RouteMetrics({
  alternative,
  distanceMeters,
  estimates,
}: {
  alternative: boolean
  distanceMeters: number
  estimates: RouteEstimates | null
}) {
  const metrics = [
    [
      alternative
        ? 'Distancia del desvío'
        : 'Distancia original',
      `${formatNumber(distanceMeters)} m`,
    ],
    [
      alternative
        ? 'Tiempo estimado del desvío'
        : 'Tiempo estimado del robot',
      estimates
        ? `${formatNumber(estimates.durationSeconds / 60)} min`
        : '—',
    ],
    [
      alternative
        ? 'Consumo estimado del desvío'
        : 'Consumo estimado del recorrido',
      estimates
        ? `${formatNumber(estimates.consumptionWh)} Wh`
        : '—',
    ],
    [
      'Capacidad de batería requerida',
      estimates
        ? `${formatNumber(estimates.requiredCapacityPercent)} %`
        : '—',
    ],
  ]

  return (
    <>
      <dl className="simulation-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="simulation-estimates-note">
        Estimaciones a velocidad constante y consumo de referencia,
        sin pendientes, clima ni consumo durante las esperas.

        {alternative
          ? ' Las métricas corresponden al desvío desde el punto donde se pausó el robot.'
          : ' Las métricas corresponden al recorrido original completo.'}

        {' '}El porcentaje expresa capacidad requerida,
        no batería restante.
      </p>

      {estimates
        && estimates.requiredCapacityPercent > 100 && (
          <p
            className="simulation-capacity-warning"
            role="status"
          >
            El consumo estimado del recorrido mostrado supera
            la capacidad nominal de batería del robot.
          </p>
        )}
    </>
  )
}

type EvaluationProps = {
  replanning: Evaluation
  motion: Motion
  robot: RobotOperatingProfile & { name: string }
  traveledEstimates: RouteEstimates | null
  clock: Clock
  blockedCount: number
  incidentSaving: boolean
}

export function RouteEvaluation({
  replanning,
  motion,
  robot,
  traveledEstimates,
  clock,
  blockedCount,
  incidentSaving,
}: EvaluationProps) {
  const {
    status,
    error,
    explanation,
    alternative,
    comparisonDistance,
    request,
  } = replanning

  const title =
    status === 'loading'
      ? 'Buscando una alternativa'
      : status === 'ready'
        ? 'Alternativa disponible'
        : status === 'unavailable'
          ? 'Sin alternativa validada'
          : status === 'error'
            ? 'No se completó la evaluación'
            : 'Evaluación pendiente'

  const difference =
    comparisonDistance !== null && alternative
      ? alternative.distanceMeters - comparisonDistance
      : null

  const checks = [
    ['Robot', robot.name],
    [
      'Velocidad operativa',
      `${formatNumber(robot.speedKmh)} km/h`,
    ],
    [
      'Consumo acumulado estimado',
      traveledEstimates
        ? `${formatNumber(traveledEstimates.consumptionWh)} Wh`
        : 'No disponible',
    ],
    [
      'Reloj del escenario',
      clock.running ? 'Avanzando' : 'Pausado',
    ],
    ['Pendientes', 'Sin verificar'],
    ['Bloqueos sobre el recorrido', String(blockedCount)],
    [
      'Alternativa',
      alternative
        ? 'Cargada en el escenario'
        : 'Sin cargar',
    ],
  ]

  return (
    <section
      className="simulation-card"
      aria-busy={status === 'loading'}
    >
      <p className="simulation-eyebrow">
        EVALUACIÓN DEL RECORRIDO
      </p>

      <h2>{title}</h2>

      {status === 'loading' && (
        <p role="status">
          El robot y el reloj están pausados.
          La IA está consultando los incidentes
          y evaluando un desvío mediante MCP.
        </p>
      )}

      {status === 'idle' && (
        <p>
          Podés iniciar el recorrido y generar un bloqueo
          por delante del robot para evaluar un desvío.
        </p>
      )}

      {explanation && (
        <>
          <p className="simulation-ai-explanation">
            {explanation}
          </p>

          <p className="simulation-estimates-note">
            La duración del proveedor corresponde al perfil peatonal.
            Las métricas del mapa utilizan la velocidad operativa
            del robot.
          </p>
        </>
      )}

      {status === 'ready'
        && motion.status === 'paused' && (
          <p className="simulation-route-comparison">
            El desvío está cargado. Pulsá Reanudar recorrido
            para continuar; si todavía no habías iniciado,
            pulsá Iniciar recorrido.
          </p>
        )}

      {error && (
        <p className="simulation-incident-error" role="alert">
          {error}
        </p>
      )}

      {difference !== null && (
        <p className="simulation-route-comparison">
          Diferencia respecto del recorrido pendiente:{' '}
          <strong>
            {difference > 0 ? '+' : ''}
            {formatNumber(difference)} m
          </strong>.
        </p>
      )}

      {(status === 'error'
        || status === 'unavailable') && (
          <button
            className="simulation-retry"
            type="button"
            onClick={() => void request()}
            disabled={incidentSaving}
          >
            Reintentar evaluación
          </button>
        )}

      <dl className="simulation-checks">
        {checks.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SimulationActivity({
  robotName,
  hasBlockages,
  replanning,
  motion,
}: {
  robotName: string
  hasBlockages: boolean
  replanning: Evaluation
  motion: Motion
}) {
  return (
    <section className="simulation-card">
      <h2>Actividad del sistema</h2>

      <ol className="simulation-activity">
        <li>
          Se recibió el robot {robotName} junto con
          el origen y el destino.
        </li>

        <li>Se calculó la ruta original.</li>

        {hasBlockages && (
          <li>
            Se registró el bloqueo y se pausó el recorrido.
          </li>
        )}

        {replanning.toolCalls.map((tool, index) => (
          <li key={`${tool.name}-${index}`}>
            {tool.name === 'consultar_incidentes'
              ? 'Consulta de incidentes'
              : tool.name === 'calcular_desvio'
                ? 'Cálculo del desvío'
                : 'Ejecución de herramienta'}
            : {tool.success ? 'completado' : 'sin éxito'}.
          </li>
        ))}

        {replanning.alternative && (
          <li>
            Se cargó una alternativa desde la posición
            donde se pausó el robot.
          </li>
        )}

        {motion.status === 'completed' && (
          <li>
            El robot alcanzó el destino. El reloj del escenario
            puede continuar avanzando.
          </li>
        )}
      </ol>
    </section>
  )
}