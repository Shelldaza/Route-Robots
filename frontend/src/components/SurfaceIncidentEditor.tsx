import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type * as L from 'leaflet'

import {
  isArea,
} from '../../../shared/surfaces'

import type { Area, Box, Point, SurfaceImpact } from '../../../shared/contracts/surfaces'

import type { PedestrianNetwork } from '../../../shared/contracts/pedestrian'

import {
  isPedestrianImpact,
} from '../utils/pedestrian-network'

import {
  fetchJson,
  errorMessage,
} from '../utils/robot-models'

import {
  createIncidentMapEditor,
  EDITOR_ICONS,
} from './incident-map-editor'

import type {
  IncidentSelection,
} from './incident-map-editor'

import './SurfaceIncidentEditor.css'

import type { IncidentEffect as Effect } from '../../../shared/contracts/incidents'

type CatalogEntry = {
  type: string
  label: string
  defaultDescription: string
  defaultDurationMinutes: number
  defaultEffect: Effect
}

type Preview = {
  impact: SurfaceImpact
  analysis: {
    state: string
    message: string
    coordinates: Point[]
    free: Area
  }
}

type Props = {
  map: L.Map | null
  simulationId: string
  network: PedestrianNetwork
  robotId: string
  coordinates: Point[]
  scenarioTime: string
  disabled: boolean
  getScenarioTime: () => string
  onSelectLocation: () => void
  onCancelSelection: () => void
  onDraftChange: (open: boolean) => void
  onBeforeCreate?: () => void
  onCreatingChange?: (saving: boolean) => void
  onCreated: () => Promise<void>
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
})

const effects: Effect[] = [
  'informational',
  'caution',
  'blockage',
]

function isCatalogEntry(
  value: unknown,
): value is CatalogEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as CatalogEntry

  return (
    typeof item.type === 'string'
    && typeof item.label === 'string'
    && typeof item.defaultDescription === 'string'
    && Number.isInteger(item.defaultDurationMinutes)
    && item.defaultDurationMinutes > 0
    && effects.includes(item.defaultEffect)
  )
}

export default function SurfaceIncidentEditor(
  props: Props,
) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [type, setType] = useState('')
  const [effect, setEffect] = useState<Effect>('blockage')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('15')

  const [scope, setScope] = useState<
    'segment' | 'street_section'
  >('segment')

  const [multiple, setMultiple] = useState(false)

  const [selection, setSelection] = useState<
    IncidentSelection | null
  >(null)

  const [editing, setEditing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readyKey, setReadyKey] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [error, setError] = useState('')

  const [message, setMessage] = useState(
    'Elegí un tipo y ubicá el incidente en el mapa del recorrido.',
  )

  const [preview, setPreview] = useState<{
    key: string
    data: Preview
  } | null>(null)

  const pending = useRef(false)
  const placement = useRef<AbortController | null>(null)
  const placementSequence = useRef(0)

  const backup = useRef<{
    selection: IncidentSelection | null
    confirmed: boolean
  }>({
    selection: null,
    confirmed: false,
  })

  const retry = useRef<{
    key: string
    endpoint: string
    body: object
  } | null>(null)

  const editor = useRef<
    ReturnType<typeof createIncidentMapEditor> | null
  >(null)

  const current = useRef({
    props,
    selection,
    scope,
    effect,
    confirmed,
    placing,
    saving,
    message,
    confirmable: false,
  })

  const contextKey =
    `${props.simulationId}:${props.robotId}:${props.network.version}:${retryKey}`

  const ready = readyKey === contextKey
  const blocked = props.disabled || saving

  const payload = selection?.mode === 'surface'
    ? {
      simulationId: props.simulationId,
      networkVersion: props.network.version,
      scenarioTime: props.scenarioTime,
      coordinates: props.coordinates,
      box: selection.box,
      effect,
    }
    : null

  const payloadKey = JSON.stringify(payload)

  const validPreview = preview?.key === payloadKey
    ? preview.data
    : null

  const confirmable = Boolean(
    selection
    && !placing
    && !blocked
    && (
      selection.mode === 'segment'
        ? selection.segments.length > 0
        : validPreview
    ),
  )

  useEffect(() => {
    current.current = {
      props,
      selection,
      scope,
      effect,
      confirmed,
      placing,
      saving,
      message,
      confirmable,
    }
  })

  useEffect(() => {
    const controller = new AbortController()

    void Promise.all([
      fetchJson('/api/surfaces/context', {
        ...post({
          simulationId: props.simulationId,
          robotId: props.robotId,
          networkVersion: props.network.version,
        }),
        signal: controller.signal,
      }),

      fetchJson('/api/incidents/catalog', {
        signal: controller.signal,
      }),
    ])
      .then(([, raw]) => {
        if (controller.signal.aborted) return

        if (
          !Array.isArray(raw)
          || !raw.length
          || !raw.every(isCatalogEntry)
        ) {
          throw new Error(
            'El catálogo de incidentes es inválido.',
          )
        }

        const first = raw[0]!

        setCatalog(raw)
        setType(first.type)
        setEffect(first.defaultEffect)
        setDescription(first.defaultDescription)
        setDuration(String(first.defaultDurationMinutes))
        setReadyKey(contextKey)
        setError('')
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(caught))
        }
      })

    return () => controller.abort()
  }, [
    props.simulationId,
    props.robotId,
    props.network.version,
    contextKey,
  ])

  useEffect(() => {
    if (payloadKey === 'null' || !ready) return

    const controller = new AbortController()

    const timer = setTimeout(() => {
      void fetchJson('/api/surfaces/preview', {
        ...post(JSON.parse(payloadKey)),
        signal: controller.signal,
      })
        .then((raw) => {
          const value = raw as Preview

          if (
            !value.impact
            || !isArea(value.impact.geometry)
            || !isArea(value.analysis?.free)
            || !Array.isArray(value.analysis.coordinates)
          ) {
            throw new Error(
              'La vista previa es inválida.',
            )
          }

          if (!controller.signal.aborted) {
            setPreview({
              key: payloadKey,
              data: value,
            })
            setError('')
          }
        })
        .catch((caught: unknown) => {
          if (!controller.signal.aborted) {
            setPreview(null)
            setError(errorMessage(caught))
          }
        })
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [payloadKey, ready])

  useEffect(() => {
    return () => {
      placement.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!editing || !props.map) return

    const controller = createIncidentMapEditor(
      props.map,
      {
        onPoint: (point) => {
          const latest = current.current

          if (
            latest.props.disabled
            || latest.saving
          ) {
            return
          }

          placement.current?.abort()

          const request = new AbortController()
          placement.current = request

          const sequence =
            ++placementSequence.current

          setPlacing(true)
          setError('')

          setMessage(
            'Buscando la superficie y los bordes de la vereda…',
          )

          void fetchJson('/api/surfaces/placement', {
            ...post({
              simulationId: latest.props.simulationId,
              networkVersion: latest.props.network.version,
              point,
            }),
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(30000),
            ]),
          })
            .then((raw) => {
              if (
                request.signal.aborted
                || sequence !== placementSequence.current
              ) {
                return
              }

              const value = raw as {
                mode?: string
                box?: Box
                segment?: unknown
                message?: string
              }

              if (
                value.mode === 'surface'
                && value.box
                && Array.isArray(value.box.center)
                && value.box.center.length === 2
                && value.box.center.every(Number.isFinite)
                && Number.isFinite(value.box.halfWidth)
                && value.box.halfWidth > 0
                && Number.isFinite(value.box.halfLength)
                && value.box.halfLength > 0
                && Number.isFinite(value.box.angle)
              ) {
                setSelection({
                  mode: 'surface',
                  box: value.box,
                })

                setMultiple(false)
              } else if (
                value.mode === 'segment'
                && value.segment
                && isPedestrianImpact({
                  networkVersion:
                    latest.props.network.version,
                  scope: 'segment',
                  segmentIds: [
                    (value.segment as { id: string }).id,
                  ],
                  segments: [value.segment],
                })
              ) {
                const segment = value.segment as Extract<
                  IncidentSelection,
                  { mode: 'segment' }
                >['segments'][number]

                const previous =
                  current.current.selection

                const old =
                  previous?.mode === 'segment'
                  && current.current.scope === 'street_section'
                    ? previous.segments
                    : []

                const next = old.some(
                  (item) => item.id === segment.id,
                )
                  ? old.filter(
                    (item) => item.id !== segment.id,
                  )
                  : [...old, segment].slice(0, 30)

                setSelection({
                  mode: 'segment',
                  segments: next,
                })
              } else {
                throw new Error(
                  'El servidor devolvió una ubicación inválida.',
                )
              }

              setConfirmed(false)

              setMessage(
                value.message
                ?? 'Revisá la ubicación y confirmala.',
              )
            })
            .catch((caught: unknown) => {
              if (
                !request.signal.aborted
                && sequence === placementSequence.current
              ) {
                setError(errorMessage(caught))
                setMessage(errorMessage(caught))
              }
            })
            .finally(() => {
              if (
                !request.signal.aborted
                && sequence === placementSequence.current
              ) {
                setPlacing(false)
              }
            })
        },

        onBox: (box) => {
          setSelection({
            mode: 'surface',
            box,
          })

          setConfirmed(false)

          setMessage(
            'Ajustando el área. Se comprobará el espacio libre antes de confirmar.',
          )
        },

        onConfirm: () => {
          if (!current.current.confirmable) return

          current.current.props.onCancelSelection()

          setConfirmed(true)
          setEditing(false)

          setMessage(
            'Ubicación confirmada. Completá los datos y creá el incidente.',
          )

          document
            .getElementById(
              `incident-form-${current.current.props.simulationId}`,
            )
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
        },

        onCancel: () => {
          placement.current?.abort()
          placementSequence.current++

          setPlacing(false)
          setSelection(backup.current.selection)
          setConfirmed(backup.current.confirmed)
          setEditing(false)
          setError('')

          current.current.props.onCancelSelection()

          if (!backup.current.confirmed) {
            current.current.props.onDraftChange(false)
          }

          setMessage(
            backup.current.confirmed
              ? 'Se conservó la ubicación confirmada.'
              : 'Selección cancelada.',
          )
        },
      },
    )

    editor.current = controller

    return () => {
      controller.remove()
      editor.current = null
    }
  }, [editing, props.map])

  useEffect(() => {
    editor.current?.update({
      selection,

      preview: validPreview
        ? {
          geometry: validPreview.impact.geometry,
          free: validPreview.analysis.free,
          coordinates:
            validPreview.analysis.state === 'local_path'
              ? validPreview.analysis.coordinates
              : [],
        }
        : null,

      effect,
      disabled: blocked || placing,
      canConfirm: confirmable,

      message:
        error
        || (
          selection?.mode === 'surface'
          && !validPreview
            ? 'Comprobando el área seleccionada…'
            : validPreview?.analysis.message ?? message
        ),
    })
  }, [
    selection,
    validPreview,
    effect,
    blocked,
    placing,
    confirmable,
    message,
    error,
    editing,
  ])

  function startEditing() {
    if (
      !ready
      || !props.map
      || blocked
    ) {
      return
    }

    backup.current = {
      selection,
      confirmed,
    }

    props.onDraftChange(true)
    props.onSelectLocation()

    setEditing(true)
    setError('')

    setMessage(
      'Hacé clic sobre una vereda. Si falta su superficie, elegí una línea peatonal.',
    )

    const map = props.map

    const point =
      selection?.mode === 'surface'
        ? selection.box.center
        : props.coordinates[0]

    map.getContainer().scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })

    if (point) {
      map.setView(
        [point[1], point[0]],
        Math.max(19, map.getZoom()),
      )
    }

    setTimeout(() => {
      map.invalidateSize()

      map.getContainer().focus({
        preventScroll: true,
      })
    }, 0)
  }

  async function save() {
    const durationMinutes = Number(duration)

    if (
      pending.current
      || blocked
      || !ready
      || !confirmed
      || editing
      || !selection
      || !catalog.some((item) => item.type === type)
      || !description.trim()
      || !Number.isInteger(durationMinutes)
      || durationMinutes < 1
      || durationMinutes > 43200
      || (
        selection.mode === 'surface'
        && (
          !validPreview
          || (
            validPreview.impact.surfaces.length > 1
            && !multiple
          )
        )
      )
      || (
        selection.mode === 'segment'
        && (
          !selection.segments.length
          || (
            scope === 'street_section'
            && selection.segments.length < 2
          )
        )
      )
    ) {
      return
    }

    pending.current = true
    setSaving(true)
    setError('')

    props.onBeforeCreate?.()
    props.onCreatingChange?.(true)

    const formKey = JSON.stringify({
      selection,
      type,
      effect,
      description: description.trim(),
      durationMinutes,
      multiple,
      scope,
    })

    if (retry.current?.key !== formKey) {
      const common = {
        id: crypto.randomUUID(),
        simulationId: props.simulationId,
        networkVersion: props.network.version,
        scenarioTime: props.getScenarioTime(),
        startsAt: props.getScenarioTime(),
        coordinates: props.coordinates,
        type,
        effect,
        description: description.trim(),
        durationMinutes,
      }

      retry.current = selection.mode === 'surface'
        ? {
          key: formKey,
          endpoint: '/api/surfaces/incidents',
          body: {
            ...common,
            box: selection.box,
            multipleSurfaces: multiple,
          },
        }
        : {
          key: formKey,
          endpoint: '/api/surfaces/segments',
          body: {
            ...common,
            pedestrianSelection: {
              networkVersion: props.network.version,
              scope,
              segmentIds: selection.segments.map(
                (segment) => segment.id,
              ),
            },
          },
        }
    }

    let saved = false

    try {
      await fetchJson(
        retry.current.endpoint,
        post(retry.current.body),
      )

      saved = true

      await props.onCreated()

      retry.current = null
      setSelection(null)
      setConfirmed(false)
      setPreview(null)

      props.onCancelSelection()
      props.onDraftChange(false)

      setMessage('Incidente registrado.')
    } catch (caught) {
      setError(
        saved
          ? 'El incidente se guardó, pero falló la actualización. Podés reintentar: se conservará el mismo identificador.'
          : errorMessage(caught),
      )
    } finally {
      pending.current = false
      setSaving(false)
      props.onCreatingChange?.(false)
    }
  }

  return (
    <div
      className="surface-editor"
      id={`incident-form-${props.simulationId}`}
    >
      <h3>Reportar incidente</h3>

      {!ready && (
        <p role="status">
          Preparando el catálogo y el contexto del robot…
        </p>
      )}

      <fieldset disabled={!ready || blocked}>
        <label>
          Tipo de incidente

          <select
            value={type}
            onChange={(event) => {
              const item = catalog.find(
                (entry) =>
                  entry.type === event.target.value,
              )

              if (item) {
                setType(item.type)
                setEffect(item.defaultEffect)
                setDescription(item.defaultDescription)

                setDuration(
                  String(item.defaultDurationMinutes),
                )
              }
            }}
          >
            {catalog.map((item) => (
              <option
                key={item.type}
                value={item.type}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Efecto sobre el paso

          <select
            value={effect}
            onChange={(event) =>
              setEffect(event.target.value as Effect)
            }
          >
            <option value="informational">
              Informativo
            </option>

            <option value="caution">
              Precaución
            </option>

            <option value="blockage">
              Bloqueo del área afectada
            </option>
          </select>
        </label>

        <p className="surface-editor-note">
          {effect === 'blockage'
            ? 'El robot intentará rodear el área dentro de la vereda; si no puede verificar ese paso, buscará otro recorrido.'
            : effect === 'caution'
              ? 'Advierte del riesgo sin cerrar el paso ni cambiar automáticamente la velocidad.'
              : 'Se muestra en el mapa sin restringir el paso.'}
        </p>

        <button
          type="button"
          disabled={!props.map || editing}
          onClick={startEditing}
        >
          {confirmed
            ? 'Editar ubicación en el mapa'
            : 'Ubicar en el mapa'}
        </button>

        <p role="status">
          {editing
            ? 'La edición está activa en el mapa del recorrido. Confirmá o cancelá allí la ubicación.'
            : message}
        </p>

        <ul className="surface-tools">
          {([
            ['move', 'Mover: arrastrá el centro.'],
            ['resize', 'Tamaño: arrastrá las esquinas.'],
            ['rotate', 'Girar: arrastrá la flecha curva.'],
          ] as const).map(([kind, label]) => (
            <li key={kind}>
              <span
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: EDITOR_ICONS[kind],
                }}
              />

              {label}
            </li>
          ))}
        </ul>

        {selection?.mode === 'segment' && (
          <>
            <p className="surface-editor-note">
              No hay un polígono de vereda disponible.
              Alcance por tramo completo: no se puede
              verificar un paso lateral.
            </p>

            <label>
              Alcance

              <select
                value={scope}
                onChange={(event) => {
                  const next =
                    event.target.value as typeof scope

                  setScope(next)

                  if (next === 'segment') {
                    setSelection({
                      mode: 'segment',
                      segments:
                        selection.segments.slice(0, 1),
                    })
                  }

                  setConfirmed(false)
                }}
              >
                <option value="segment">
                  Solo un tramo
                </option>

                <option value="street_section">
                  Varios tramos seleccionados
                </option>
              </select>
            </label>

            <p>
              {selection.segments.length} tramo(s).
              Para ampliar el alcance, editá la ubicación
              y seleccioná cada tramo.
              No se incluye automáticamente la vereda de enfrente.
            </p>
          </>
        )}

        {selection?.mode === 'surface' && validPreview && (
          <>
            <p role="status">
              {validPreview.analysis.message}
            </p>

            {validPreview.impact.surfaces.length > 1 && (
              <label className="surface-checkbox">
                <input
                  type="checkbox"
                  checked={multiple}
                  onChange={(event) =>
                    setMultiple(event.target.checked)
                  }
                />

                Confirmo que afecta{' '}
                {validPreview.impact.surfaces.length}
                {' '}superficies.
              </label>
            )}
          </>
        )}

        <label>
          Descripción

          <textarea
            rows={3}
            maxLength={500}
            value={description}
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
            max={43200}
            step={1}
            value={duration}
            onChange={(event) =>
              setDuration(event.target.value)
            }
          />
        </label>

        <button
          type="button"
          onClick={() => void save()}
          disabled={
            !confirmed
            || editing
            || placing
            || !selection
            || !description.trim()
            || !Number.isInteger(Number(duration))
            || Number(duration) < 1
            || Number(duration) > 43200
            || (
              selection.mode === 'surface'
              && (
                !validPreview
                || (
                  validPreview.impact.surfaces.length > 1
                  && !multiple
                )
              )
            )
            || (
              selection.mode === 'segment'
              && (
                !selection.segments.length
                || (
                  scope === 'street_section'
                  && selection.segments.length < 2
                )
              )
            )
          }
        >
          {saving ? 'Guardando…' : 'Crear incidente'}
        </button>

        {selection && !editing && (
          <button
            type="button"
            onClick={() => {
              setSelection(null)
              setConfirmed(false)
              setPreview(null)
              retry.current = null

              props.onCancelSelection()
              props.onDraftChange(false)

              setMessage('Selección cancelada.')
            }}
          >
            Cancelar reporte
          </button>
        )}
      </fieldset>

      {error && (
        <p
          role="alert"
          className="simulation-incident-error"
        >
          {error}
        </p>
      )}

      {!ready && error && (
        <button
          type="button"
          onClick={() =>
            setRetryKey((value) => value + 1)
          }
        >
          Reintentar conexión
        </button>
      )}

      <details>
        <summary>Información cartográfica</summary>

        <p>
          Se utiliza la capa actual de veredas y cruces.
          Escaleras y veredas ocultas se muestran con
          trazos discontinuos y no habilitan el paso.
        </p>

        <p>
          El dibujo inicial abarca el ancho encontrado
          hasta los primeros bordes, con un largo
          de 1 metro. Revisalo antes de confirmar.
        </p>

        <p>
          El cálculo geométrico considera ancho
          y margen lateral; no verifica longitud
          del robot, radio de giro, pendiente
          ni condiciones actuales.
        </p>
      </details>
    </div>
  )
}