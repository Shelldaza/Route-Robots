import { useRef, useState } from 'react'
import * as L from 'leaflet'

export type BlockedArea = {
  south: number
  west: number
  north: number
  east: number
}

type Incident = {
  id: string
  simulationId: string
  type: 'blockage'
  source: 'simulation'
  blockedArea: BlockedArea
  createdAt: string
  expiresAt: string
}

type Coordinate = [number, number]

type Props = {
  simulationId: string
  coordinates: Coordinate[]
  onBlockedAreasChange: (areas: BlockedArea[]) => void
  onBeforeCreate?: () => void
  onCreatingChange?: (creating: boolean) => void
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

function isIncident(value: unknown): value is Incident {
  if (!value || typeof value !== 'object') return false

  const incident = value as Record<string, unknown>

  return (
    typeof incident.id === 'string' &&
    incident.id.trim().length > 0 &&
    typeof incident.simulationId === 'string' &&
    incident.simulationId.trim().length > 0 &&
    incident.type === 'blockage' &&
    incident.source === 'simulation' &&
    isBlockedArea(incident.blockedArea) &&
    typeof incident.createdAt === 'string' &&
    Number.isFinite(Date.parse(incident.createdAt)) &&
    typeof incident.expiresAt === 'string' &&
    Number.isFinite(Date.parse(incident.expiresAt))
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
      'Para generar este bloqueo deben quedar al menos 80 metros de recorrido.',
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
        previous.lat + (current.lat - previous.lat) * fraction,
        previous.lng + (current.lng - previous.lng) * fraction,
      )

      break
    }

    accumulated += segmentDistance
  }

  if (!center) {
    throw new Error(
      'No se pudo ubicar el bloqueo sobre el recorrido pendiente.',
    )
  }

  // Zona de aproximadamente 20 × 20 metros.
  // Aproximación local para la demo en Washington D. C.
  const halfHeight = 10 / 111320
  const halfWidth =
    10 / (111320 * Math.cos((center.lat * Math.PI) / 180))

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
      'El bloqueo quedaría sobre la posición actual o el destino. Probá otro recorrido.',
    )
  }

  return area
}

function SimulationIncidentSection({
  simulationId,
  coordinates,
  onBlockedAreasChange,
  onBeforeCreate,
  onCreatingChange,
}: Props) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pendingRef = useRef(false)

  async function simulateBlockage() {
    if (pendingRef.current || incident) return

    pendingRef.current = true
    setSaving(true)
    setError('')

    try {
      // Pausa el robot y bloquea los controles antes de consultar
      // o registrar el incidente.
      onBeforeCreate?.()
      onCreatingChange?.(true)

      // Recupera un incidente si una solicitud anterior llegó
      // a guardarlo, pero se perdió su respuesta.
      const listResponse = await fetch(
        `/api/incidents?simulationId=${encodeURIComponent(simulationId)}`,
        {
          signal: AbortSignal.timeout(40000),
        },
      )

      const existing = await readResponse(listResponse)

      if (
        !Array.isArray(existing) ||
        !existing.every(isIncident) ||
        existing.some(
          (item) => item.simulationId !== simulationId,
        )
      ) {
        throw new Error(
          'El servidor devolvió incidentes inválidos.',
        )
      }

      const previous = existing[0]

      if (previous) {
        setIncident(previous)
        onBlockedAreasChange(
          existing.map((item) => item.blockedArea),
        )
        return
      }

      const blockedArea = createMiddleBlockage(coordinates)

      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulationId,
          blockedArea,
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

      setIncident(body)

      // La pantalla inicia la replanificación mediante este callback.
      onBlockedAreasChange([body.blockedArea])
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.name === 'TimeoutError'
      ) {
        setError(
          'La operación tardó demasiado. Reintentá para comprobar si el bloqueo se guardó.',
        )
      } else if (caught instanceof TypeError) {
        setError('No se pudo conectar con el backend.')
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo crear el bloqueo.',
        )
      }
    } finally {
      pendingRef.current = false
      setSaving(false)
      onCreatingChange?.(false)
    }
  }

  return (
    <section className="simulation-card simulation-incidents">
      <p className="simulation-eyebrow">ESCENARIO DE PRUEBA</p>
      <h2>Incidentes del recorrido</h2>

      <p>
        Generá un bloqueo sobre la mitad del recorrido pendiente.
        El robot se pausará, el incidente aparecerá en el mapa y
        se solicitará una alternativa mediante IA.
      </p>

      <button
        className="simulation-incident-button"
        type="button"
        onClick={() => void simulateBlockage()}
        disabled={saving || incident !== null}
      >
        {saving
          ? 'Registrando bloqueo…'
          : incident
            ? 'Bloqueo registrado'
            : 'Simular bloqueo en el recorrido'}
      </button>

      {error && (
        <p className="simulation-incident-error" role="alert">
          {error}
        </p>
      )}

      {incident && (
        <div
          className="simulation-incident-result"
          role="status"
        >
          <p>
            <strong>Bloqueo registrado.</strong> Consultá el
            resultado de la evaluación en el panel del recorrido.
          </p>

          <p>
            Vencimiento del registro:{' '}
            {new Date(incident.expiresAt).toLocaleTimeString(
              'es-AR',
            )}{' '}
            (hora local).
          </p>
        </div>
      )}
    </section>
  )
}

export default SimulationIncidentSection