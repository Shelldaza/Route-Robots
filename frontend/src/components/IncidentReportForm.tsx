import { useEffect, useRef, useState } from 'react'

export type IncidentPoint = {
  lat: number
  lng: number
}

type CatalogEntry = {
  type: string
  label: string
  defaultDescription: string
  defaultDurationMinutes: number
  defaultEffect: 'informational' | 'caution' | 'blockage'
  iconFile: string
}

type Props = {
  simulationId: string
  point: IncidentPoint | null
  selecting: boolean
  disabled: boolean
  getScenarioTime: () => string
  onSelectLocation: () => void
  onCancelSelection: () => void
  onBeforeCreate: () => void
  onCreatingChange: (creating: boolean) => void
  onCreated: () => Promise<void>
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== 'object') return false

  const item = value as Record<string, unknown>

  return (
    typeof item.type === 'string' &&
    typeof item.label === 'string' &&
    typeof item.defaultDescription === 'string' &&
    typeof item.defaultDurationMinutes === 'number' &&
    Number.isInteger(item.defaultDurationMinutes) &&
    item.defaultDurationMinutes > 0 &&
    (
      item.defaultEffect === 'informational' ||
      item.defaultEffect === 'caution' ||
      item.defaultEffect === 'blockage'
    ) &&
    typeof item.iconFile === 'string'
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

function IncidentReportForm({
  simulationId,
  point,
  selecting,
  disabled,
  getScenarioTime,
  onSelectLocation,
  onCancelSelection,
  onBeforeCreate,
  onCreatingChange,
  onCreated,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  const pendingRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/incidents/catalog', {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
        })

        const body = await readResponse(response)

        if (
          !Array.isArray(body) ||
          body.length === 0 ||
          !body.every(isCatalogEntry)
        ) {
          throw new Error(
            'El servidor devolvió un catálogo inválido.',
          )
        }

        const first = body[0]

        if (!first || controller.signal.aborted) return

        setCatalog(body)
        setSelectedType(first.type)
        setDescription(first.defaultDescription)
        setDurationMinutes(
          String(first.defaultDurationMinutes),
        )
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudo cargar el catálogo.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadCatalog()

    return () => controller.abort()
  }, [retryKey])

  function changeType(type: string) {
    const item = catalog.find(
      (entry) => entry.type === type,
    )

    if (!item) return

    setSelectedType(type)
    setDescription(item.defaultDescription)
    setDurationMinutes(
      String(item.defaultDurationMinutes),
    )
    setError('')
    setSuccess('')
  }

  async function submitReport() {
    if (pendingRef.current || disabled) return

    const selected = catalog.find(
      (entry) => entry.type === selectedType,
    )

    const duration = Number(durationMinutes)

    if (!selected || !point) {
      setError('Elegí un tipo y una ubicación en el mapa.')
      return
    }

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 30 * 24 * 60
    ) {
      setError(
        'La duración debe ser de entre 1 minuto y 30 días.',
      )
      return
    }

    const text =
      description.trim() || selected.defaultDescription

    if (text.length > 500) {
      setError(
        'La descripción admite hasta 500 caracteres.',
      )
      return
    }

    // Área aproximada de 20 × 20 metros.
    const halfHeight = 10 / 111320
    const halfWidth =
      10 / (
        111320 *
        Math.cos((point.lat * Math.PI) / 180)
      )

    const blockedArea = {
      south: point.lat - halfHeight,
      west: point.lng - halfWidth,
      north: point.lat + halfHeight,
      east: point.lng + halfWidth,
    }

    pendingRef.current = true
    setSaving(true)
    setError('')
    setSuccess('')

    let saved = false

    try {
      onBeforeCreate()
      onCreatingChange(true)

      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulationId,
          type: selected.type,
          source: 'manual',
          description: text,
          durationMinutes: duration,
          reporterName: 'Usuario',
          startsAt: getScenarioTime(),
          blockedArea,
        }),
        signal: AbortSignal.timeout(40000),
      })

      await readResponse(response)
      saved = true

      // Actualiza el historial y el mapa antes de terminar.
      await onCreated()

      onCancelSelection()
      setSuccess('Incidente registrado.')
    } catch (caught) {
      if (saved) {
        onCancelSelection()
        setError(
          'El incidente se guardó, pero no se pudo actualizar la pantalla. Usá Actualizar incidentes antes de crear otro.',
        )
      } else {
        setError(
          caught instanceof Error &&
          caught.name === 'TimeoutError'
            ? 'La solicitud tardó demasiado. Actualizá los incidentes para comprobar si el reporte se guardó.'
            : caught instanceof Error
              ? caught.message
              : 'No se pudo registrar el incidente.',
        )
      }
    } finally {
      pendingRef.current = false
      setSaving(false)
      onCreatingChange(false)
    }
  }

  return (
    <div className="incident-report-form">
      <h3>Reportar incidente</h3>

      {loading ? (
        <p role="status">Cargando tipos de incidente…</p>
      ) : catalog.length === 0 ? (
        <button
          type="button"
          className="simulation-retry"
          onClick={() =>
            setRetryKey((current) => current + 1)
          }
        >
          Reintentar carga del catálogo
        </button>
      ) : (
        <fieldset disabled={disabled || saving}>
          <label>
            Tipo de incidente

            <select
              value={selectedType}
              onChange={(event) =>
                changeType(event.target.value)
              }
            >
              {catalog.map((entry) => (
                <option
                  key={entry.type}
                  value={entry.type}
                >
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="simulation-incident-button"
            type="button"
            onClick={() => {
              setError('')
              setSuccess('')
              onSelectLocation()
            }}
          >
            {point
              ? 'Cambiar ubicación'
              : 'Seleccionar ubicación en el mapa'}
          </button>

          <p role="status">
            {selecting
              ? 'Hacé clic en el mapa. Podés mover el marcador antes de confirmar.'
              : point
                ? `Ubicación: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                : 'Todavía no seleccionaste una ubicación.'}
          </p>

          <details>
            <summary>Editar descripción y duración</summary>

            <label>
              Descripción

              <textarea
                value={description}
                maxLength={500}
                rows={3}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
              />
            </label>

            <label>
              Duración en minutos

              <input
                type="number"
                min={1}
                max={30 * 24 * 60}
                step={1}
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(event.target.value)
                }
              />
            </label>

            <p>
              1 día equivale a 1440 minutos.
              El tipo seleccionado ya propone una duración.
            </p>
          </details>

          <button
            className="simulation-incident-button"
            type="button"
            onClick={() => void submitReport()}
            disabled={!point}
          >
            {saving ? 'Guardando…' : 'Crear incidente'}
          </button>

          {(selecting || point) && (
            <button
              className="simulation-retry"
              type="button"
              onClick={onCancelSelection}
            >
              Cancelar ubicación
            </button>
          )}
        </fieldset>
      )}

      {error && (
        <p
          className="simulation-incident-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && <p role="status">{success}</p>}
    </div>
  )
}

export default IncidentReportForm