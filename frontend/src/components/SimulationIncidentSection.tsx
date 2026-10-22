import type * as L from 'leaflet'

import type {
  IncidentDTO as Incident,
} from '../../../shared/contracts/incidents'

import type {
  Bounds as BlockedArea,
  Coordinate,
} from '../../../shared/contracts/geography'

import type {
  PedestrianNetwork,
} from '../../../shared/contracts/pedestrian'

import {
  useSimulationIncidents,
} from '../hooks/useSimulationIncidents'

import {
  isIncident,
} from '../features/incidents/incident-validation'

import SurfaceIncidentEditor from './SurfaceIncidentEditor'
import RandomFleetReports from './RandomFleetReports'
import IncidentHistory from './IncidentHistory'

type Props = {
  robotId: string
  simulationId: string
  coordinates: Coordinate[]
  scenarioTime: string
  randomReportsDisabled: boolean
  getScenarioTime: () => string
  legacyAreaTestsEnabled: boolean
  network: PedestrianNetwork | null
  map: L.Map | null
  editorDisabled: boolean
  onDraftChange: (open: boolean) => void
  selectingLocation: boolean
  onSelectLocation: () => void
  onCancelSelection: () => void
  onBeforeCreate?: () => void
  onCreatingChange?: (creating: boolean) => void
  onActiveIncidentsChange: (incidents: Incident[]) => void
  onBlockedAreasChange: (
    areas: BlockedArea[],
    options: { requestReplanning: boolean },
  ) => void
}

// El padre proporciona el robot.
// El panel ya no necesita interpretar el estado del router.
export default function SimulationIncidentSection(
  props: Props,
) {
  const {
    robotId,
    simulationId,
    coordinates,
    scenarioTime,
    getScenarioTime,
    onBeforeCreate,
    randomReportsDisabled,
    legacyAreaTestsEnabled,
    network,
    map,
    editorDisabled,
    onDraftChange,
    selectingLocation,
    onSelectLocation,
    onCancelSelection,
  } = props

  const model = useSimulationIncidents(props)

  const {
    incidents,
    nowMs,
    active,
    routeBlockages,
    finished,
    scheduled,
    loading,
    savingQuickTest,
    busy,
    error,
    refreshHistory,
    handleCreatingChange,
    simulateBlockage,
  } = model

  return (
    <section
      className="simulation-card simulation-incidents"
      aria-busy={busy}
    >
      <p className="simulation-eyebrow">
        ESCENARIO DE PRUEBA
      </p>

      <h2>Incidentes del escenario</h2>

      {network && robotId && (
        <SurfaceIncidentEditor
          simulationId={simulationId}
          map={map}
          network={network}
          robotId={robotId}
          coordinates={coordinates}
          scenarioTime={scenarioTime}
          getScenarioTime={getScenarioTime}
          disabled={loading || editorDisabled}
          onSelectLocation={onSelectLocation}
          onCancelSelection={onCancelSelection}
          onDraftChange={onDraftChange}
          onBeforeCreate={onBeforeCreate}
          onCreatingChange={handleCreatingChange}
          onCreated={refreshHistory}
        />
      )}

      {network && (
        <RandomFleetReports
          simulationId={simulationId}
          networkVersion={network.version}
          scenarioTime={scenarioTime}
          coordinates={coordinates}
          disabled={
            randomReportsDisabled
            || busy
            || selectingLocation
          }
          validateIncident={isIncident}
          onReported={model.onReported}
        />
      )}

      {legacyAreaTestsEnabled && (
        <details>
          <summary>Prueba rápida de bloqueo</summary>

          <button
            type="button"
            onClick={() => void simulateBlockage()}
            disabled={
              busy
              || coordinates.length < 2
              || routeBlockages.length > 0
            }
          >
            {savingQuickTest
              ? 'Registrando…'
              : 'Simular bloqueo de 15 minutos en el recorrido'}
          </button>
        </details>
      )}

      {error && (
        <p
          className="simulation-incident-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={model.reload}
        disabled={busy}
      >
        {loading
          ? 'Actualizando…'
          : 'Actualizar incidentes'}
      </button>

      <p role="status">
        Activos: {active.length}
        {' · '}
        Restricciones sobre el recorrido: {routeBlockages.length}
        {' · '}
        Programados: {scheduled}
        {' · '}
        Finalizados: {finished}.
        La vigencia sigue el reloj del escenario.
      </p>

      <IncidentHistory
        incidents={incidents}
        nowMs={nowMs}
      />
    </section>
  )
}