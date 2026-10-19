import { useEffect, useRef, useState } from 'react'
import { segmentLabels } from '../utils/pedestrian-network'
import type { PedestrianNetwork, PedestrianSegment } from '../utils/pedestrian-network'

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
  network: PedestrianNetwork | null
  selectedSegments: PedestrianSegment[]
  scope: 'segment' | 'street_section'
  onScopeChange: (scope: 'segment' | 'street_section') => void
  onToggleSegment: (segment: PedestrianSegment) => void
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
  network,
  selectedSegments,
  scope,
  onScopeChange,
  onToggleSegment,
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
  const [effect, setEffect] = useState<CatalogEntry['defaultEffect']>('blockage')
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
        setEffect(first.defaultEffect)
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
    setEffect(item.defaultEffect)
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

    if (!selected || !network || !selectedSegments.length || (scope === 'street_section' && selectedSegments.length < 2)) {
      setError('Elegí un tipo y los tramos afectados; el alcance ampliado requiere al menos dos.')
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
          effect,
          pedestrianSelection: {
            networkVersion: network.version,
            scope,
            segmentIds: selectedSegments.map((segment) => segment.id),
          },
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
      {!network && <p role="status">Para reportar sobre veredas, iniciá una entrega en el sandbox peatonal. {" "}Si ya lo elegiste, recargá para reintentar la carga de la red.</p>}

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
        <fieldset disabled={disabled || saving || !network}>
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
            {selectedSegments.length > 0
              ? 'Cambiar ubicación'
              : 'Seleccionar ubicación en el mapa'}
          </button>

          <p role="status">
            {selecting
              ? 'Elegí las líneas resaltadas. Cada clic selecciona o retira un tramo.'
              : selectedSegments.length ? `${selectedSegments.length} tramo(s) seleccionado(s).` : 'Todavía no seleccionaste un tramo.'}
          </p>
          <label>
            Efecto sobre el paso
            <select value={effect} onChange={(event) => setEffect(event.target.value as CatalogEntry['defaultEffect'])}>
              <option value="informational">Informativo</option>
              <option value="caution">Precaución</option>
              <option value="blockage">Bloqueo</option>
            </select>
          </label>
          <label>
            Alcance
            <select value={scope} onChange={(event) => onScopeChange(event.target.value as 'segment' | 'street_section')}>
              <option value="segment">Solo el tramo seleccionado</option>
              <option value="street_section">Ambas veredas y cruces de la sección (seleccionar tramos)</option>
            </select>
          </label>
          {scope === 'street_section' && <p>Seleccioná cada tramo afectado de ambas veredas y de los cruces. Solo se cerrarán las líneas rojas; revisalas antes de guardar. Máximo: 30 tramos cercanos.</p>}
          {selecting && network && <label>
            Elegir tramo por identificador
            <select value="" onChange={(event) => {
              const segment = network.segments.find((item) => item.id === event.target.value)
              if (segment) onToggleSegment(segment)
            }}>
              <option value="">Elegir un tramo…</option>
              {network.segments.map((segment) => <option key={segment.id} value={segment.id}>
                {segmentLabels[segment.kind]} · {segment.name || segment.id}
              </option>)}
            </select>
          </label>}
          {selectedSegments.length > 0 && <ul>{selectedSegments.map((segment) => <li key={segment.id}>
            {segmentLabels[segment.kind]} · {segment.name || segment.id}
            <button type="button" onClick={() => onToggleSegment(segment)}>Quitar</button>
          </li>)}</ul>}

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
            disabled={!network || selectedSegments.length === 0 || (scope === 'street_section' && selectedSegments.length < 2)}
          >
            {saving ? 'Guardando…' : 'Crear incidente'}
          </button>

          {(selecting || selectedSegments.length > 0) && (
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