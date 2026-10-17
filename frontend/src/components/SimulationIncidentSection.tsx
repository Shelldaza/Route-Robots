import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'

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

type Incident = {
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

type Coordinate = [number, number]

type ChangeOptions = {
  requestReplanning: boolean
}

type Props = {
  simulationId: string
  coordinates: Coordinate[]
  scenarioTime: string
  getScenarioTime: () => string
  onBeforeCreate?: () => void
  onCreatingChange?: (creating: boolean) => void
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

function isIncident(value: unknown): value is Incident {
  if (!value || typeof value !== 'object') return false

  const incident = value as Record<string, unknown>

  return (
    typeof incident.id === 'string' &&
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

function getIncidentStatus(
  incident: Incident,
  nowMs: number,
): 'scheduled' | 'active' | 'finished' {
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

  // Área aproximada de 20 × 20 metros para Washington D. C.
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
    return 'La operación tardó demasiado. Reintentá para comprobar si el bloqueo se guardó.'
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
  onBlockedAreasChange,
}: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const pendingRef = useRef(false)

  const changeCallbackRef = useRef(onBlockedAreasChange)
  const previousBlockagesRef = useRef('[]')

  useEffect(() => {
    changeCallbackRef.current = onBlockedAreasChange
  }, [onBlockedAreasChange])

  // Descarga el historial al montar o al reintentar.
  // No consulta la API en cada tick del reloj.
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

  const activeIncidents = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'active',
  )

  const activeBlockages = activeIncidents.filter(
    (incident) => incident.effect === 'blockage',
  )

  // Una clave estable evita notificar al padre en cada tick.
  const blockagesKey = JSON.stringify(
    activeBlockages
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

    type BlockageRecord = {
      id: string
      blockedArea: BlockedArea
    }

    const previous = JSON.parse(
      previousKey,
    ) as BlockageRecord[]

    const current = JSON.parse(
      blockagesKey,
    ) as BlockageRecord[]

    const previousRecords = new Set(
      previous.map((record) => JSON.stringify(record)),
    )

    // Un bloqueo nuevo o un área modificada requiere evaluar.
    // La desaparición de un bloqueo no solicita IA.
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

  async function simulateBlockage() {
    if (
      pendingRef.current ||
      loading ||
      activeBlockages.length > 0
    ) {
      return
    }

    pendingRef.current = true
    setSaving(true)
    setError('')

    try {
      onBeforeCreate?.()
      onCreatingChange?.(true)

      // El padre ya pausó el escenario.
      const startsAt = getScenarioTime()
      const atMs = Date.parse(startsAt)

      // Recupera un bloqueo activo si una respuesta anterior
      // se perdió después de guardarlo.
      const history = await fetchHistory(
        simulationId,
        startsAt,
        AbortSignal.timeout(40000),
      )

      setIncidents(history)

      const existingBlockage = history.find(
        (incident) =>
          incident.effect === 'blockage' &&
          getIncidentStatus(incident, atMs) === 'active',
      )

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
      setSaving(false)
      onCreatingChange?.(false)
    }
  }

  const finishedCount = incidents.filter(
    (incident) =>
      getIncidentStatus(incident, nowMs) === 'finished',
  ).length

  return (
    <section className="simulation-card simulation-incidents">
      <p className="simulation-eyebrow">
        ESCENARIO DE PRUEBA
      </p>

      <h2>Incidentes del escenario</h2>

      <p>
        Generá un bloqueo sobre la mitad del recorrido
        pendiente. Durará 15 minutos del escenario y
        activará la evaluación de una alternativa.
      </p>

      <button
        className="simulation-incident-button"
        type="button"
        onClick={() => void simulateBlockage()}
        disabled={
          loading ||
          saving ||
          activeBlockages.length > 0
        }
      >
        {loading
          ? 'Cargando incidentes…'
          : saving
            ? 'Registrando bloqueo…'
            : activeBlockages.length > 0
              ? 'Hay un bloqueo activo'
              : 'Simular bloqueo en el recorrido'}
      </button>

      {error && (
        <>
          <p
            className="simulation-incident-error"
            role="alert"
          >
            {error}
          </p>

          <button
            className="simulation-retry"
            type="button"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
            disabled={loading || saving}
          >
            Actualizar incidentes
          </button>
        </>
      )}

      <div
        className="simulation-incident-result"
        role="status"
      >
        <p>
          <strong>Activos:</strong>{' '}
          {activeIncidents.length}
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

            const statusLabel =
              status === 'active'
                ? 'Activo'
                : status === 'scheduled'
                  ? 'Programado'
                  : 'Finalizado'

            return (
              <div
                className="simulation-incident-result"
                key={incident.id}
              >
                <p>
                  <strong>
                    {INCIDENT_LABELS[incident.type]}
                  </strong>
                  {' · '}{statusLabel}
                </p>

                <p>{incident.description}</p>

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