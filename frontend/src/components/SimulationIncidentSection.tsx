import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import { getRouteBlockages } from '../utils/route-geometry'

import IncidentReportForm from './IncidentReportForm'
import type { IncidentPoint } from './IncidentReportForm'

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
  source: 'simulation' | 'manual' | 'ai_generated'
  description: string
  effect: IncidentEffect
  reporterName: string | null
  blockedArea: BlockedArea
  createdAt: string
  startsAt: string
  expiresAt: string
}

// Las coordenadas de las rutas usan el orden GeoJSON:
// [longitud, latitud].
type Coordinate = [number, number]

type IncidentStatus =
  | 'scheduled'
  | 'active'
  | 'finished'

type BlockageRecord = {
  id: string
  blockedArea: BlockedArea
}

type ChangeOptions = {
  requestReplanning: boolean
}

type Props = {
  simulationId: string
  coordinates: Coordinate[]
  scenarioTime: string
  getScenarioTime: () => string

  // La página administra los clics y el marcador del mapa.
  selectedPoint: IncidentPoint | null
  selectingLocation: boolean
  onSelectLocation: () => void
  onCancelSelection: () => void

  onBeforeCreate?: () => void
  onCreatingChange?: (creating: boolean) => void
  onActiveIncidentsChange: (incidents: Incident[]) => void

  onBlockedAreasChange: (
    areas: BlockedArea[],
    options: ChangeOptions,
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

function isBlockedArea(value: unknown): value is BlockedArea {
  if (!value || typeof value !== 'object') return false

  const area = value as Record<string, unknown>

  return (
    typeof area.south === 'number' &&
    Number.isFinite(area.south) &&
    area.south >= -90 &&
    typeof area.north === 'number' &&
    Number.isFinite(area.north) &&
    area.north <= 90 &&
    area.south < area.north &&
    typeof area.west === 'number' &&
    Number.isFinite(area.west) &&
    area.west >= -180 &&
    typeof area.east === 'number' &&
    Number.isFinite(area.east) &&
    area.east <= 180 &&
    area.west < area.east
  )
}

function isDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value))
  )
}

// Las respuestas HTTP se validan antes de incorporarlas al estado.
// Una anotación de TypeScript no valida los datos recibidos.
function isIncident(value: unknown): value is Incident {
  if (!value || typeof value !== 'object') return false

  const incident = value as Record<string, unknown>

  return (
    typeof incident.id === 'string' &&
    incident.id.length > 0 &&
    typeof incident.simulationId === 'string' &&
    typeof incident.type === 'string' &&
    Object.prototype.hasOwnProperty.call(
      INCIDENT_LABELS,
      incident.type,
    ) &&
    (
      incident.source === 'simulation' ||
      incident.source === 'manual' ||
      incident.source === 'ai_generated'
    ) &&
    typeof incident.description === 'string' &&
    (
      incident.effect === 'informational' ||
      incident.effect === 'caution' ||
      incident.effect === 'blockage'
    ) &&
    (
      incident.reporterName === null ||
      typeof incident.reporterName === 'string'
    ) &&
    isBlockedArea(incident.blockedArea) &&
    isDateString(incident.createdAt) &&
    isDateString(incident.startsAt) &&
    isDateString(incident.expiresAt) &&
    Date.parse(incident.expiresAt) >
    Date.parse(incident.startsAt)
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

function validateIncidentList(
  value: unknown,
  simulationId: string,
): Incident[] {
  if (
    !Array.isArray(value) ||
    !value.every(isIncident) ||
    value.some(
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
    `/api/incidents?${query.toString()}`,
    { signal },
  )

  const body = await readResponse(response)

  return validateIncidentList(body, simulationId)
}

// La vigencia depende del reloj del escenario, no de Date.now().
// El instante de vencimiento ya pertenece al estado "finalizado".
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

// La prueba rápida coloca el bloqueo en la mitad de la distancia
// del recorrido, no en el elemento central del arreglo.
function createMiddleBlockage(
  coordinates: Coordinate[],
): BlockedArea {
  const positions = coordinates.map(
    ([lng, lat]) => L.latLng(lat, lng),
  )

  let totalDistance = 0

  for (let index = 1; index < positions.length; index += 1) {
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

  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1]
    const current = positions[index]

    if (!previous || !current) continue

    const segmentDistance = previous.distanceTo(current)

    if (
      segmentDistance > 0 &&
      accumulated + segmentDistance >= targetDistance
    ) {
      const fraction =
        (targetDistance - accumulated) / segmentDistance

      center = L.latLng(
        previous.lat +
        (current.lat - previous.lat) * fraction,
        previous.lng +
        (current.lng - previous.lng) * fraction,
      )

      break
    }

    accumulated += segmentDistance
  }

  if (!center) {
    throw new Error(
      'No se pudo ubicar el bloqueo sobre el recorrido.',
    )
  }

  // Aproximación local de un área de 20 × 20 metros.
  const halfHeight = 10 / 111320
  const halfWidth =
    10 / (
      111320 *
      Math.cos((center.lat * Math.PI) / 180)
    )

  const area: BlockedArea = {
    south: center.lat - halfHeight,
    west: center.lng - halfWidth,
    north: center.lat + halfHeight,
    east: center.lng + halfWidth,
  }

  const origin = positions[0]
  const destination = positions[positions.length - 1]

  const contains = (point: L.LatLng) =>
    point.lat >= area.south &&
    point.lat <= area.north &&
    point.lng >= area.west &&
    point.lng <= area.east

  // Evita crear una prueba sin salida por cubrir al robot
  // o al punto al que debe llegar.
  if (
    !origin ||
    !destination ||
    contains(origin) ||
    contains(destination)
  ) {
    throw new Error(
      'El bloqueo quedaría sobre el robot o el destino. Probá otro recorrido.',
    )
  }

  return area
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.name === 'TimeoutError'
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

function SimulationIncidentSection({
  simulationId,
  coordinates,
  scenarioTime,
  getScenarioTime,
  onBeforeCreate,
  onCreatingChange,
  onActiveIncidentsChange,
  onBlockedAreasChange,
  selectedPoint,
  selectingLocation,
  onSelectLocation,
  onCancelSelection,
}: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [savingQuickTest, setSavingQuickTest] = useState(false)
  const [savingManualReport, setSavingManualReport] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const activeIncidentsCallbackRef = useRef(onActiveIncidentsChange)

  useEffect(() => {
    activeIncidentsCallbackRef.current = onActiveIncidentsChange
  }, [onActiveIncidentsChange])

  // El ref impide dos solicitudes rápidas antes de que React
  // llegue a renderizar el botón deshabilitado.
  const pendingRef = useRef(false)

  const changeCallbackRef = useRef(onBlockedAreasChange)
  const previousBlockagesRef = useRef('[]')

  const saving = savingQuickTest || savingManualReport
  const busy = loading || saving

  // Mantiene el callback actualizado sin volver a notificar
  // los mismos bloqueos por cada render del padre.
  useEffect(() => {
    changeCallbackRef.current = onBlockedAreasChange
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
          setIncidents(history)
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
  }, [simulationId, getScenarioTime, reloadKey])

  const nowMs = Date.parse(scenarioTime)

  // El historial se conserva completo. Los estados se derivan
  // localmente sin consultar el backend en cada tick del reloj.
  const activeIncidents = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'active',
  )

  // Se recalcula también al avanzar o cargar un desvío: un bloqueo
  // puede seguir activo en el mapa y dejar de afectar al tramo pendiente.
  const routeBlockages = getRouteBlockages(coordinates, activeIncidents)

  const finishedCount = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'finished',
  ).length

  const scheduledCount =
    incidents.length -
    activeIncidents.length -
    finishedCount

  // El reloj cambia continuamente, pero el mapa solo necesita actualizarse
  // cuando cambia el conjunto de incidentes activos o sus datos.
  const activeIncidentsKey = JSON.stringify(
    [...activeIncidents].sort((first, second) =>
      first.id.localeCompare(second.id),
    ),
  )

  useEffect(() => {
    const current = JSON.parse(activeIncidentsKey) as Incident[]

    activeIncidentsCallbackRef.current(current)
  }, [activeIncidentsKey])
  // La clave omite los bloqueos lejanos y los que quedaron atrás.
  // Aunque las coordenadas cambien en cada fotograma, solo notificamos
  // si cambia el conjunto de bloqueos que cruza el recorrido pendiente.
  const blockagesKey = JSON.stringify(
    routeBlockages
      .map((incident) => ({
        id: incident.id,
        blockedArea: incident.blockedArea,
      }))
      .sort((first, second) =>
        first.id.localeCompare(second.id),
      ),
  )

  useEffect(() => {
    const previousKey = previousBlockagesRef.current

    if (previousKey === blockagesKey) return

    // Estas cadenas se generan dentro del componente.
    // Los datos de la API ya fueron validados al recibirlos.
    const previous =
      JSON.parse(previousKey) as BlockageRecord[]

    const current =
      JSON.parse(blockagesKey) as BlockageRecord[]

    const previousRecords = new Set(
      previous.map((record) => JSON.stringify(record)),
    )

    // Un bloqueo que pasa a afectar al recorrido requiere evaluación.
    // Retirarlo por vencimiento o por cargar un desvío no solicita IA.
    const requestReplanning = current.some(
      (record) =>
        !previousRecords.has(JSON.stringify(record)),
    )

    previousBlockagesRef.current = blockagesKey

    changeCallbackRef.current(
      current.map((record) => record.blockedArea),
      { requestReplanning },
    )
  }, [blockagesKey])

  // El formulario espera esta promesa para distinguir entre
  // un fallo al guardar y un fallo al actualizar la pantalla.
  async function refreshHistory(): Promise<void> {
    const history = await fetchHistory(
      simulationId,
      getScenarioTime(),
      AbortSignal.timeout(40000),
    )

    setIncidents(history)
    setError('')
  }

  function handleManualCreatingChange(creating: boolean) {
    setSavingManualReport(creating)
    onCreatingChange?.(creating)
  }

  async function simulateBlockage() {
    if (
      pendingRef.current ||
      busy ||
      coordinates.length < 2 ||
      routeBlockages.length > 0
    ) {
      return
    }

    pendingRef.current = true
    setSavingQuickTest(true)
    setError('')

    try {
      onBeforeCreate?.()
      onCreatingChange?.(true)

      // Se toma la fecha después de pausar el escenario.
      const startsAt = getScenarioTime()
      const atMs = Date.parse(startsAt)

      // Antes de insertar, recupera un posible bloqueo cuya
      // respuesta se haya perdido en una solicitud anterior.
      // Esto no reemplaza una clave de idempotencia del backend.
      const history = await fetchHistory(
        simulationId,
        startsAt,
        AbortSignal.timeout(40000),
      )

      setIncidents(history)

      const existingBlockage = getRouteBlockages(
        coordinates,
        history.filter((incident) =>
          getIncidentStatus(incident, atMs) === 'active',
        ),
      )[0]

      if (existingBlockage) return

      const blockedArea = createMiddleBlockage(coordinates)

      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulationId,
          blockedArea,
          type: 'blockage',
          source: 'simulation',
          startsAt,
          durationMinutes: 15,
        }),
        signal: AbortSignal.timeout(40000),
      })

      const body = await readResponse(response)

      if (
        !isIncident(body) ||
        body.simulationId !== simulationId
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
      pendingRef.current = false
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

      <p>
        Reportá un incidente seleccionando su tipo y
        ubicación. La descripción y la duración tienen
        valores predeterminados que podés editar.
      </p>

      <IncidentReportForm
        simulationId={simulationId}
        point={selectedPoint}
        selecting={selectingLocation}
        disabled={busy}
        getScenarioTime={getScenarioTime}
        onSelectLocation={onSelectLocation}
        onCancelSelection={onCancelSelection}
        onBeforeCreate={() => onBeforeCreate?.()}
        onCreatingChange={handleManualCreatingChange}
        onCreated={refreshHistory}
      />

      {/* Se conserva como herramienta de prueba mientras
          el formulario manual incorpora todas las opciones. */}
      <details className="simulation-quick-test">
        <summary>Prueba rápida de bloqueo</summary>

        <p>
          Coloca un bloqueo de 15 minutos en la mitad
          del recorrido pendiente.
        </p>

        <button
          className="simulation-incident-button"
          type="button"
          onClick={() => void simulateBlockage()}
          disabled={
            busy ||
            coordinates.length < 2 ||
            routeBlockages.length > 0
          }
        >
          {loading
            ? 'Cargando incidentes…'
            : savingQuickTest
              ? 'Registrando bloqueo…'
              : routeBlockages.length > 0
                ? 'Hay un bloqueo sobre el recorrido'
                : coordinates.length < 2
                  ? 'Sin recorrido pendiente'
                  : 'Simular bloqueo en el recorrido'}
        </button>
      </details>

      {error && (
        <p
          className="simulation-incident-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Disponible también sin error para recuperar reportes
          creados desde otra petición o con respuesta perdida. */}
      <button
        className="simulation-retry"
        type="button"
        onClick={() =>
          setReloadKey((current) => current + 1)
        }
        disabled={busy}
      >
        {loading
          ? 'Actualizando incidentes…'
          : 'Actualizar incidentes'}
      </button>

      <div
        className="simulation-incident-result"
        role="status"
      >
        <p>
          <strong>Activos:</strong>{' '}
          {activeIncidents.length}
          {' · '}
          <strong>Bloqueos sobre el recorrido:</strong>{' '}
          {routeBlockages.length}
          {' · '}
          <strong>Programados:</strong>{' '}
          {scheduledCount}
          {' · '}
          <strong>Finalizados:</strong>{' '}
          {finishedCount}
        </p>

        <p>
          La vigencia sigue el reloj del escenario.
          Los incidentes finalizados se conservan
          en el historial.
        </p>
      </div>

      {incidents.length > 0 && (
        <details>
          <summary>
            Historial de incidentes ({incidents.length})
          </summary>

          {incidents.map((incident) => {
            const status = getIncidentStatus(
              incident,
              nowMs,
            )

            return (
              <div
                className="simulation-incident-result"
                key={incident.id}
              >
                <p>
                  <strong>
                    {INCIDENT_LABELS[incident.type]}
                  </strong>
                  {' · '}
                  {STATUS_LABELS[status]}
                </p>

                <p>{incident.description}</p>

                <p>
                  Efecto:{' '}
                  {EFFECT_LABELS[incident.effect]}
                </p>

                <p>
                  Informante:{' '}
                  {incident.reporterName ?? 'Sin identificar'}
                </p>

                <p>
                  Inicio: {formatDate(incident.startsAt)}
                </p>

                <p>
                  Fin: {formatDate(incident.expiresAt)}
                </p>
              </div>
            )
          })}
        </details>
      )}
    </section>
  )
}

export default SimulationIncidentSection