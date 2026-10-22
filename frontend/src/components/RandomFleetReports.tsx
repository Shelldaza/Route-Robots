import {
  useRandomReportScheduler,
} from '../hooks/useRandomReportScheduler';

import {
  useFleetNotifications,
} from '../hooks/useFleetNotifications';

import type { Coordinate } from '../../../shared/contracts/geography'


import type { IncidentDTO as Incident } from '../../../shared/contracts/incidents'

import {
  getIncidentAppearance,
} from '../utils/incident-icons'



type Props = {
  simulationId: string
  networkVersion: string
  scenarioTime: string
  coordinates: Coordinate[]
  disabled: boolean
  onReported: (incident: Incident) => void
}



function reportText(incident: Incident) {
  const segment =
    incident.pedestrianImpact?.segments[0]

  const point = segment?.coordinates[
    Math.floor(segment.coordinates.length / 2)
  ]

  const location = point
    ? `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`
    : 'la red peatonal'

  const label =
    getIncidentAppearance(incident.type).label

  return (
    `${incident.reporterName ?? 'Robot simulado'} `
    + `informó: ${label}. `
    + `Ubicación aproximada: ${location}.`
  )
}

export default function RandomFleetReports({
  simulationId,
  networkVersion,
  scenarioTime,
  coordinates,
  disabled,
  onReported,
}: Props) {

  const {
    notices,
    toast,
    notify,
    dismiss,
  } = useFleetNotifications(onReported);

  const {
    enabled,
    index,
    routeCount,
    nextAt,
    sending,
    error,
    message,
    toggle,
    retry,
  } = useRandomReportScheduler({
    simulationId,
    networkVersion,
    scenarioTime,
    coordinates,
    disabled,
    onReported: notify,
  });

  const seconds = Math.max(
    0,
    Math.ceil(
      (nextAt - Date.parse(scenarioTime)) / 1000,
    ),
  )

  return (
    <div className="random-fleet-reports">
      <h3>Reportes de la flota simulada</h3>

      <p>
        Un reporte cada 2–3 minutos del escenario,
        dentro de 1,2 km del robot. En cada bloque
        de 100 reportes, 15 se ubican sobre el
        recorrido pendiente.
      </p>

      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => toggle(event.target.checked)}
        />
        Generar reportes automáticamente
      </label>

      <p className="simulation-estimates-note">
        {disabled
          ? 'Generación en espera.'
          : coordinates.length < 2
            ? 'La entrega no tiene recorrido pendiente.'
            : !enabled
              ? 'Generación desactivada.'
              : sending
                ? 'Registrando reporte…'
                : (
                  `Próximo reporte en `
                  + `${Math.floor(seconds / 60)} min `
                  + `${seconds % 60} s simulados.`
                )}
        {' '}
        Reportes registrados: {index}.
        {' '}
        Sobre el recorrido: {routeCount}.
      </p>

      {message && (
        <p role="status">{message}</p>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={retry}
          >
            Reintentar reporte
          </button>
        </div>
      )}

      <ol className="random-fleet-feed">
        {notices.map(({ incident, onRoute }) => (
          <li key={incident.id}>
            <time dateTime={incident.startsAt}>
              {new Date(
                incident.startsAt,
              ).toLocaleTimeString('es-AR')}
            </time>

            <p>{reportText(incident)}</p>

            <small>
              {onRoute
                ? 'Sobre el recorrido al generar el reporte'
                : 'Fuera del recorrido al generar el reporte'}
              {' · '}
              {incident.effect === 'blockage'
                ? 'Bloqueo'
                : incident.effect === 'caution'
                  ? 'Precaución'
                  : 'Informativo'}
            </small>
          </li>
        ))}
      </ol>

      {toast && (
        <div
          className="random-fleet-toast"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={dismiss}
          >
            ×
          </button>

          <strong>
            Nuevo reporte de la flota simulada
          </strong>

          <p>{reportText(toast.incident)}</p>
        </div>
      )}
    </div>
  )
}
