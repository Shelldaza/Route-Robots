import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'

import type * as L from 'leaflet'

import type {
  PedestrianNetwork,
} from '../../../shared/contracts/pedestrian'

import type {
  Point,
  Box,
} from '../../../shared/contracts/surfaces'

import type {
  IncidentEffect,
} from '../../../shared/contracts/incidents'

import type {
  IncidentPreview,
} from '../features/incidents/incident-validation'

import {
  errorMessage,
} from '../api/client'

import {
  prepareEditor,
  requestPlacement,
  requestPreview,
  saveEditorReport,
} from '../features/incidents/editor-api'

import type {
  CatalogEntry,
} from '../features/incidents/editor-api'

import {
  editorReducer,
  initialEditorState,
  isEditing,
} from '../features/incidents/editor-state'

import type {
  EditorScope,
} from '../features/incidents/editor-state'

import {
  prepareSubmission,
} from '../features/incidents/editor-submission'

import type {
  Submission,
} from '../features/incidents/editor-submission'

import {
  useIncidentMapEditing,
} from './useIncidentMapEditing'

export type SurfaceEditorProps = {
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

// Coordina el formulario, HTTP y el adaptador del mapa.
// Las transiciones de selección se resuelven en editorReducer.
export function useSurfaceIncidentEditor(
  props: SurfaceEditorProps,
) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialEditorState,
  )

  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [type, setType] = useState('')
  const [effect, setEffect] = useState<IncidentEffect>('blockage')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('15')
  const [multiple, setMultiple] = useState(false)
  const [readyKey, setReadyKey] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [error, setError] = useState('')

  const [message, setMessage] = useState(
    'Elegí un tipo y ubicá el incidente en el mapa del recorrido.',
  )

  const [preview, setPreview] = useState<{
    key: string
    data: IncidentPreview
  } | null>(null)

  const placement = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const pending = useRef(false)
  const retry = useRef<Submission | null>(null)
  const latestContext = useRef('')

  const contextKey =
    `${props.simulationId}:${props.robotId}:${props.network.version}:${retryKey}`

  useEffect(() => {
    latestContext.current = contextKey
  }, [contextKey])

  const ready = readyKey === contextKey
  const editing = isEditing(state)
  const placing = state.phase === 'locating'
  const saving = state.phase === 'saving'
  const confirmed = state.phase === 'confirmed' || saving
  const blocked = props.disabled || saving
  const { selection, scope } = state

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
        ? selection.segments.length
        : validPreview
    ),
  )

  const validLocation = selection?.mode === 'surface'
    ? Boolean(
      validPreview
      && (
        validPreview.impact.surfaces.length <= 1
        || multiple
      ),
    )
    : Boolean(
      selection?.segments.length
      && (
        scope === 'segment'
        || selection.segments.length >= 2
      ),
    )

  const canSave =
    ready
    && !blocked
    && state.phase === 'confirmed'
    && validLocation
    && catalog.some((item) => item.type === type)
    && Boolean(description.trim())
    && Number.isInteger(Number(duration))
    && Number(duration) >= 1
    && Number(duration) <= 43200

  useEffect(() => {
    const controller = new AbortController()

    async function initialize() {
      dispatch({ type: 'discard' })
      retry.current = null
      setPreview(null)

      return prepareEditor(
        {
          simulationId: props.simulationId,
          robotId: props.robotId,
          networkVersion: props.network.version,
        },
        controller.signal,
      )
    }

    void initialize()
      .then((items) => {
        if (controller.signal.aborted) return

        const first = items[0]!

        setCatalog(items)
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
    contextKey,
    props.simulationId,
    props.robotId,
    props.network.version,
  ])

  useEffect(() => {
    if (!ready || payloadKey === 'null') return

    const controller = new AbortController()

    const timer = setTimeout(() => {
      void requestPreview(
        JSON.parse(payloadKey),
        controller.signal,
      )
        .then((data) => {
          if (!controller.signal.aborted) {
            setPreview({ key: payloadKey, data })
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
      sequence.current++
      placement.current?.abort()
    }
  }, [contextKey])

  async function place(point: Point) {
    if (blocked || !editing) return

    placement.current?.abort()

    const controller = new AbortController()
    placement.current = controller

    const requestSequence = ++sequence.current

    dispatch({ type: 'locate' })
    setError('')

    setMessage(
      'Buscando la superficie y los bordes de la vereda…',
    )

    try {
      const value = await requestPlacement(
        props.simulationId,
        props.network.version,
        point,
        controller.signal,
      )

      if (
        controller.signal.aborted
        || requestSequence !== sequence.current
      ) {
        return
      }

      if (value.mode === 'surface') {
        dispatch({
          type: 'select',
          selection: {
            mode: 'surface',
            box: value.box,
          },
        })

        setMultiple(false)
      } else {
        const old =
          selection?.mode === 'segment'
          && scope === 'street_section'
            ? selection.segments
            : []

        const segments = old.some(
          (item) => item.id === value.segment.id,
        )
          ? old.filter(
            (item) => item.id !== value.segment.id,
          )
          : [...old, value.segment].slice(0, 30)

        dispatch({
          type: 'select',
          selection: {
            mode: 'segment',
            segments,
          },
        })
      }

      setMessage(value.message)
    } catch (caught) {
      if (
        !controller.signal.aborted
        && requestSequence === sequence.current
      ) {
        setError(errorMessage(caught))
        setMessage(errorMessage(caught))
      }
    } finally {
      if (
        !controller.signal.aborted
        && requestSequence === sequence.current
      ) {
        dispatch({ type: 'located' })
      }
    }
  }

  function confirm() {
    if (
      !confirmable
      || state.phase !== 'editing'
    ) {
      return
    }

    dispatch({ type: 'confirm' })
    props.onCancelSelection()

    setMessage(
      'Ubicación confirmada. Completá los datos y creá el incidente.',
    )

    document
      .getElementById(
        `incident-form-${props.simulationId}`,
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
  }

  function cancelEditing() {
    sequence.current++
    placement.current?.abort()

    const restored =
      state.backup?.phase === 'confirmed'

    dispatch({ type: 'cancel' })
    setError('')

    props.onCancelSelection()

    props.onDraftChange(
      Boolean(state.backup?.selection),
    )

    setMessage(
      restored
        ? 'Se conservó la ubicación confirmada.'
        : 'Selección cancelada.',
    )
  }

  function updateBox(box: Box) {
    dispatch({
      type: 'select',
      selection: {
        mode: 'surface',
        box,
      },
    })

    setMessage(
      'Ajustando el área. Se comprobará el espacio libre antes de confirmar.',
    )
  }

  useIncidentMapEditing({
    map: props.map,
    editing,
    onPoint: (point) => void place(point),
    onBox: updateBox,
    onConfirm: confirm,
    onCancel: cancelEditing,

    state: {
      selection,
      effect,
      disabled: blocked || placing,
      canConfirm: confirmable,

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

      message:
        error
        || (
          selection?.mode === 'surface'
          && !validPreview
            ? 'Comprobando el área seleccionada…'
            : validPreview?.analysis.message ?? message
        ),
    },
  })

  function startEditing() {
    const map = props.map

    if (
      !ready
      || !map
      || blocked
      || editing
    ) {
      return
    }

    dispatch({ type: 'begin' })
    props.onDraftChange(true)
    props.onSelectLocation()
    setError('')

    setMessage(
      'Hacé clic sobre una vereda. Si falta su superficie, elegí una línea peatonal.',
    )

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

  function discard() {
    if (pending.current) return

    sequence.current++
    placement.current?.abort()

    dispatch({ type: 'discard' })
    setPreview(null)
    retry.current = null

    props.onCancelSelection()
    props.onDraftChange(false)
    setMessage('Selección cancelada.')
  }

  async function save() {
    if (
      !canSave
      || !selection
      || pending.current
    ) {
      return
    }

    pending.current = true
    dispatch({ type: 'save' })
    setError('')

    let saved = false

    try {
      props.onBeforeCreate?.()
      props.onCreatingChange?.(true)

      retry.current = prepareSubmission(
        retry.current,
        {
          contextKey,
          simulationId: props.simulationId,
          networkVersion: props.network.version,
          coordinates: props.coordinates,
          selection,
          type,
          effect,
          description,
          durationMinutes: Number(duration),
          multiple,
          scope,
        },
        props.getScenarioTime,
      )

      await saveEditorReport(
        retry.current.endpoint,
        retry.current.body,
      )

      saved = true

      await props.onCreated()

      if (latestContext.current !== contextKey) {
        return
      }

      retry.current = null

      dispatch({ type: 'saved' })
      setPreview(null)

      props.onCancelSelection()
      props.onDraftChange(false)
      setMessage('Incidente registrado.')
    } catch (caught) {
      if (latestContext.current === contextKey) {
        dispatch({ type: 'saveFailed' })

        setError(
          saved
            ? 'El incidente se guardó, pero falló la actualización. Podés reintentar: se conservará el mismo identificador.'
            : errorMessage(caught),
        )
      }
    } finally {
      pending.current = false
      props.onCreatingChange?.(false)
    }
  }

  function changeType(value: string) {
    const entry = catalog.find(
      (item) => item.type === value,
    )

    if (!entry) return

    setType(entry.type)
    setEffect(entry.defaultEffect)
    setDescription(entry.defaultDescription)
    setDuration(String(entry.defaultDurationMinutes))
  }

  function changeScope(value: EditorScope) {
    dispatch({
      type: 'scope',
      scope: value,
    })
  }

  return {
    catalog,
    type,
    effect,
    description,
    duration,
    multiple,
    ready,
    blocked,
    selection,
    scope,
    editing,
    confirmed,
    placing,
    saving,
    phase: state.phase,
    error,
    message,
    validPreview,
    canSave,
    startEditing,
    save,
    discard,
    changeType,
    setEffect,
    setDescription,
    setDuration,
    setMultiple,
    changeScope,

    reconnect: () =>
      setRetryKey((key) => key + 1),
  }
}