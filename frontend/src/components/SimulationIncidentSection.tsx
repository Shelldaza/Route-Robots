import {
  useEffect,
  useRef,
  useState,
} from 'react'

import * as L from 'leaflet'
import { useLocation } from 'react-router'

import SurfaceIncidentEditor from './SurfaceIncidentEditor'
import RandomFleetReports from './RandomFleetReports'

import {
  isArea,
  lineHits,
} from '../../../shared/surfaces'

import type {
  SurfaceImpact,
} from '../../../shared/surfaces'

import {
  getRouteBlockages,
} from '../utils/route-geometry'

import {
  isPedestrianImpact,
} from '../utils/pedestrian-network'

import type {
  PedestrianImpact,
  PedestrianNetwork,
} from '../utils/pedestrian-network'

export type BlockedArea = {
  south: number
  west: number
  north: number
  east: number
}

type IncidentEffect =
  | 'informational'
  | 'caution'
  | 'blockage'

export type Incident = {
  id: string
  simulationId: string
  type: string
  source:
    | 'simulation'
    | 'manual'
    | 'ai_generated'
  description: string
  effect: IncidentEffect
  reporterName: string | null
  blockedArea: BlockedArea
  pedestrianImpact?: PedestrianImpact | null
  surfaceImpact?: SurfaceImpact | null
  createdAt: string
  startsAt: string
  expiresAt: string
}

type Coordinate = [number, number]

type IncidentStatus =
  | 'scheduled'
  | 'active'
  | 'finished'

type BlockageRecord = {
  id: string
  blockedArea: BlockedArea
}

type Props = {
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
  onCreatingChange?: (
    creating: boolean,
  ) => void
  onActiveIncidentsChange: (
    incidents: Incident[],
  ) => void
  onBlockedAreasChange: (
    areas: BlockedArea[],
    options: {
      requestReplanning: boolean
    },
  ) => void
}

const INCIDENT_LABELS: Record<string, string> = {
  blockage: 'Bloqueo',
  temporary_obstacle: 'Obstáculo temporal',
  temporary_closure: 'Cierre temporal',
  roadworks: 'Obras',
  standing_water: 'Acumulación de agua',
  crowd: 'Aglomeración de personas',
  obstructing_vehicle: 'Vehículo obstruyendo el paso',
  scheduled_event: 'Evento programado',
  pothole: 'Bache',
  uneven_surface: 'Superficie irregular',
}

const EFFECT_LABELS: Record<IncidentEffect, string> = {
  informational: 'Informativo',
  caution: 'Precaución',
  blockage: 'Bloqueo',
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  scheduled: 'Programado',
  active: 'Activo',
  finished: 'Finalizado',
}

function isBlockedArea(
  value: unknown,
): value is BlockedArea {
  if (!value || typeof value !== 'object') {
    return false
  }

  const area = value as Record<string, unknown>

  return (
    typeof area.south === 'number'
    && Number.isFinite(area.south)
    && area.south >= -90
    && typeof area.north === 'number'
    && Number.isFinite(area.north)
    && area.north <= 90
    && area.south < area.north
    && typeof area.west === 'number'
    && Number.isFinite(area.west)
    && area.west >= -180
    && typeof area.east === 'number'
    && Number.isFinite(area.east)
    && area.east <= 180
    && area.west < area.east
  )
}

function isDateString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string'
    && Number.isFinite(Date.parse(value))
  )
}

function isIncident(
  value: unknown,
): value is Incident {
  if (!value || typeof value !== 'object') {
    return false
  }

  const incident = value as Record<string, unknown>

  return (
    typeof incident.id === 'string'
    && incident.id.length > 0
    && typeof incident.simulationId === 'string'
    && typeof incident.type === 'string'
    && Object.prototype.hasOwnProperty.call(
      INCIDENT_LABELS,
      incident.type,
    )
    && (
      incident.source === 'simulation'
      || incident.source === 'manual'
      || incident.source === 'ai_generated'
    )
    && typeof incident.description === 'string'
    && (
      incident.effect === 'informational'
      || incident.effect === 'caution'
      || incident.effect === 'blockage'
    )
    && (
      incident.reporterName === null
      || typeof incident.reporterName === 'string'
    )
    && (
      incident.pedestrianImpact == null
      || isPedestrianImpact(
        incident.pedestrianImpact,
      )
    )
    && (
      incident.surfaceImpact == null
      || (
        typeof incident.surfaceImpact === 'object'
        && isArea(
          (
            incident.surfaceImpact as SurfaceImpact
          ).geometry,
        )
        && isArea(
          (
            incident.surfaceImpact as SurfaceImpact
          ).collisionGeometry,
        )
      )
    )
    && isBlockedArea(incident.blockedArea)
    && isDateString(incident.createdAt)
    && isDateString(incident.startsAt)
    && isDateString(incident.expiresAt)
    && Date.parse(incident.expiresAt)
      > Date.parse(incident.startsAt)
  )
}

async function readResponse(
  response: Response,
): Promise<unknown> {
  const body: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    const message =
      body
      && typeof body === 'object'
      && 'message' in body
      && typeof body.message === 'string'
        ? body.message
        : 'No se pudo completar la operación.'

    throw new Error(message)
  }

  return body
}

function validateIncidentList(
  value: unknown,
  simulationId: string,
): Incident[] {
  if (
    !Array.isArray(value)
    || !value.every(isIncident)
    || value.some(
      (incident) =>
        incident.simulationId !== simulationId,
    )
  ) {
    throw new Error(
      'El servidor devolvió incidentes inválidos.',
    )
  }

  return value
}

async function fetchHistory(
  simulationId: string,
  scenarioTime: string,
  signal: AbortSignal,
): Promise<Incident[]> {
  const query = new URLSearchParams({
    simulationId,
    scenarioTime,
    includeHistory: 'true',
  })

  const response = await fetch(
    `/api/surfaces/history?${query}`,
    { signal },
  )

  return validateIncidentList(
    await readResponse(response),
    simulationId,
  )
}

function getIncidentStatus(
  incident: Incident,
  nowMs: number,
): IncidentStatus {
  if (Date.parse(incident.startsAt) > nowMs) {
    return 'scheduled'
  }

  if (Date.parse(incident.expiresAt) <= nowMs) {
    return 'finished'
  }

  return 'active'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function createMiddleBlockage(
  coordinates: Coordinate[],
): BlockedArea {
  const positions = coordinates.map(
    ([lng, lat]) => L.latLng(lat, lng),
  )

  let totalDistance = 0

  for (
    let index = 1;
    index < positions.length;
    index++
  ) {
    const previous = positions[index - 1]
    const current = positions[index]

    if (previous && current) {
      totalDistance += previous.distanceTo(current)
    }
  }

  if (totalDistance < 80) {
    throw new Error(
      'Para esta prueba necesitás al menos 80 metros de recorrido pendiente.',
    )
  }

  const targetDistance = totalDistance / 2

  let accumulated = 0
  let center: L.LatLng | null = null

  for (
    let index = 1;
    index < positions.length;
    index++
  ) {
    const previous = positions[index - 1]
    const current = positions[index]

    if (!previous || !current) continue

    const distance = previous.distanceTo(current)

    if (
      distance > 0
      && accumulated + distance >= targetDistance
    ) {
      const fraction =
        (targetDistance - accumulated) / distance

      center = L.latLng(
        previous.lat
          + (current.lat - previous.lat) * fraction,
        previous.lng
          + (current.lng - previous.lng) * fraction,
      )

      break
    }

    accumulated += distance
  }

  if (!center) {
    throw new Error(
      'No se pudo ubicar el bloqueo sobre el recorrido.',
    )
  }

  const halfHeight = 10 / 111320

  const halfWidth =
    10 / (
      111320
      * Math.cos(center.lat * Math.PI / 180)
    )

  const area: BlockedArea = {
    south: center.lat - halfHeight,
    west: center.lng - halfWidth,
    north: center.lat + halfHeight,
    east: center.lng + halfWidth,
  }

  const origin = positions[0]
  const destination = positions.at(-1)

  const contains = (point: L.LatLng) =>
    point.lat >= area.south
    && point.lat <= area.north
    && point.lng >= area.west
    && point.lng <= area.east

  if (
    !origin
    || !destination
    || contains(origin)
    || contains(destination)
  ) {
    throw new Error(
      'El bloqueo quedaría sobre el robot o el destino. Probá otro recorrido.',
    )
  }

  return area
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
    && error.name === 'TimeoutError'
  ) {
    return 'La operación tardó demasiado. Actualizá los incidentes para comprobar si el reporte se guardó.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.'
}

function mergeIncidents(
  current: Incident[],
  incoming: Incident[],
): Incident[] {
  const records = new Map(
    current.map((incident) => [
      incident.id,
      incident,
    ]),
  )

  for (const incident of incoming) {
    records.set(incident.id, incident)
  }

  return [...records.values()].sort(
    (a, b) =>
      Date.parse(b.startsAt)
      - Date.parse(a.startsAt),
  )
}

export default function SimulationIncidentSection({
  simulationId,
  coordinates,
  scenarioTime,
  getScenarioTime,
  onBeforeCreate,
  onCreatingChange,
  randomReportsDisabled,
  onActiveIncidentsChange,
  onBlockedAreasChange,
  legacyAreaTestsEnabled,
  network,
  map,
  editorDisabled,
  onDraftChange,
  selectingLocation,
  onSelectLocation,
  onCancelSelection,
}: Props) {
  const location = useLocation()

  const navigation = location.state as {
    robot?: {
      id?: string
    }
  } | null

  const robotId = navigation?.robot?.id

  const [incidents, setIncidents] =
    useState<Incident[]>([])

  const [loading, setLoading] = useState(true)

  const [savingQuickTest, setSavingQuickTest] =
    useState(false)

  const [savingManualReport, setSavingManualReport] =
    useState(false)

  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const activeCallback = useRef(
    onActiveIncidentsChange,
  )

  const changeCallback = useRef(
    onBlockedAreasChange,
  )

  const previousBlockages = useRef('[]')
  const pending = useRef(false)

  const busy =
    loading
    || savingQuickTest
    || savingManualReport

  useEffect(() => {
    activeCallback.current =
      onActiveIncidentsChange
  }, [onActiveIncidentsChange])

  useEffect(() => {
    changeCallback.current =
      onBlockedAreasChange
  }, [onBlockedAreasChange])

  useEffect(() => {
    const controller = new AbortController()

    async function loadHistory() {
      setLoading(true)
      setError('')

      try {
        const history = await fetchHistory(
          simulationId,
          getScenarioTime(),
          AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(40000),
          ]),
        )

        if (!controller.signal.aborted) {
          setIncidents((current) =>
            mergeIncidents(current, history),
          )
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(caught))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return () => controller.abort()
  }, [
    simulationId,
    getScenarioTime,
    reloadKey,
  ])

  const nowMs = Date.parse(scenarioTime)

  const active = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'active',
  )

  const routeBlockages = [
    ...getRouteBlockages(
      coordinates,
      active.filter(
        (incident) => !incident.surfaceImpact,
      ),
    ),

    ...active.filter((incident) =>
      incident.effect === 'blockage'
      && incident.surfaceImpact
      && lineHits(
        coordinates,
        incident.surfaceImpact.collisionGeometry,
      ),
    ),
  ]

  const finishedCount = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'finished',
  ).length

  const scheduledCount =
    incidents.length
    - active.length
    - finishedCount

  const activeKey = JSON.stringify(
    active.map((incident) =>
      incident.surfaceImpact
        ? {
          ...incident,
          pedestrianImpact: null,
        }
        : incident,
    ).sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
  )

  useEffect(() => {
    activeCallback.current(
      JSON.parse(activeKey) as Incident[],
    )
  }, [activeKey])

  const blockagesKey = JSON.stringify(
    routeBlockages.map((incident) => ({
      id: incident.id,
      blockedArea: incident.blockedArea,
    })).sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
  )

  useEffect(() => {
    if (
      previousBlockages.current === blockagesKey
    ) {
      return
    }

    const previous = JSON.parse(
      previousBlockages.current,
    ) as BlockageRecord[]

    const current = JSON.parse(
      blockagesKey,
    ) as BlockageRecord[]

    const previousRecords = new Set(
      previous.map(
        (record) => JSON.stringify(record),
      ),
    )

    const requestReplanning = current.some(
      (record) =>
        !previousRecords.has(
          JSON.stringify(record),
        ),
    )

    previousBlockages.current = blockagesKey

    changeCallback.current(
      current.map(
        (record) => record.blockedArea,
      ),
      { requestReplanning },
    )
  }, [blockagesKey])

  async function refreshHistory(): Promise<void> {
    const history = await fetchHistory(
      simulationId,
      getScenarioTime(),
      AbortSignal.timeout(40000),
    )

    setIncidents((current) =>
      mergeIncidents(current, history),
    )

    setError('')
  }

  function handleCreatingChange(
    creating: boolean,
  ) {
    setSavingManualReport(creating)
    onCreatingChange?.(creating)
  }

  async function simulateBlockage() {
    if (
      pending.current
      || busy
      || coordinates.length < 2
      || routeBlockages.length > 0
    ) {
      return
    }

    pending.current = true
    setSavingQuickTest(true)
    setError('')

    try {
      onBeforeCreate?.()
      onCreatingChange?.(true)

      const startsAt = getScenarioTime()
      const atMs = Date.parse(startsAt)

      const history = await fetchHistory(
        simulationId,
        startsAt,
        AbortSignal.timeout(40000),
      )

      setIncidents((current) =>
        mergeIncidents(current, history),
      )

      const existing = getRouteBlockages(
        coordinates,
        history.filter(
          (incident) =>
            getIncidentStatus(
              incident,
              atMs,
            ) === 'active',
        ),
      )[0]

      if (existing) return

      const response = await fetch(
        '/api/incidents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            simulationId,
            blockedArea:
              createMiddleBlockage(coordinates),
            type: 'blockage',
            source: 'simulation',
            startsAt,
            durationMinutes: 15,
          }),
          signal: AbortSignal.timeout(40000),
        },
      )

      const body = await readResponse(response)

      if (
        !isIncident(body)
        || body.simulationId !== simulationId
      ) {
        throw new Error(
          'El servidor devolvió un incidente inválido.',
        )
      }

      setIncidents([
        body,
        ...history.filter(
          (incident) => incident.id !== body.id,
        ),
      ])
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      pending.current = false
      setSavingQuickTest(false)
      onCreatingChange?.(false)
    }
  }

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
          onReported={(incident) =>
            setIncidents((current) =>
              mergeIncidents(
                current,
                [incident],
              ),
            )
          }
        />
      )}

      {legacyAreaTestsEnabled && (
        <details>
          <summary>
            Prueba rápida de bloqueo
          </summary>

          <button
            type="button"
            onClick={() =>
              void simulateBlockage()
            }
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
        onClick={() =>
          setReloadKey(
            (current) => current + 1,
          )
        }
        disabled={busy}
      >
        {loading
          ? 'Actualizando…'
          : 'Actualizar incidentes'}
      </button>

      <p role="status">
        Activos: {active.length}
        {' · '}
        Restricciones sobre el recorrido:
        {' '}{routeBlockages.length}
        {' · '}
        Programados: {scheduledCount}
        {' · '}
        Finalizados: {finishedCount}.
        La vigencia sigue el reloj del escenario.
      </p>

      <details>
        <summary>
          Historial de incidentes
          {' '}({incidents.length})
        </summary>

        {incidents.map((incident) => (
          <div
            className="simulation-incident-result"
            key={incident.id}
          >
            <strong>
              {INCIDENT_LABELS[incident.type]}
              {' · '}
              {STATUS_LABELS[
                getIncidentStatus(
                  incident,
                  nowMs,
                )
              ]}
            </strong>

            <p>{incident.description}</p>

            <p>
              {incident.surfaceImpact
                ? `Efecto: ${EFFECT_LABELS[incident.effect]}. Área delimitada sobre la superficie cartográfica.`
                : `Efecto: ${EFFECT_LABELS[incident.effect]}. Alcance: ${incident.pedestrianImpact ? 'Tramos completos' : 'Área de prueba'}.`}
            </p>

            <p>
              Informante:{' '}
              {incident.reporterName
                ?? 'Sin identificar'}
            </p>

            <p>
              Inicio:
              {' '}{formatDate(incident.startsAt)}
              {' · '}
              Fin:
              {' '}{formatDate(incident.expiresAt)}
            </p>
          </div>
        ))}
      </details>
    </section>
  )
}
