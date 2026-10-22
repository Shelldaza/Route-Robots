import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  IncidentDTO as Incident,
} from '../../../shared/contracts/incidents'

import type {
  Bounds,
  Coordinate,
} from '../../../shared/contracts/geography'

import {
  createQuickIncident,
  fetchIncidentHistory,
  incidentErrorMessage,
} from '../features/incidents/incident-api.ts'

import {
  getIncidentSummary,
  mergeIncidents,
} from '../features/incidents/incident-rules.ts'

type Options = {
  simulationId: string
  coordinates: Coordinate[]
  scenarioTime: string
  getScenarioTime: () => string
  onBeforeCreate?: () => void
  onCreatingChange?: (creating: boolean) => void
  onActiveIncidentsChange: (incidents: Incident[]) => void
  onBlockedAreasChange: (
    areas: Bounds[],
    options: { requestReplanning: boolean },
  ) => void
}

// Coordina consultas y notificaciones.
// Las reglas de vigencia y colisión permanecen fuera de React.
export function useSimulationIncidents(
  options: Options,
) {
  const {
    simulationId,
    getScenarioTime,
  } = options

  const [records, setRecords] = useState<{
    id: string
    items: Incident[]
  }>({
    id: simulationId,
    items: [],
  })

  const [loading, setLoading] = useState(true)
  const [savingQuickTest, setSavingQuickTest] = useState(false)
  const [savingManualReport, setSavingManualReport] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const pending = useRef(false)
  const current = useRef(options)
  const previousActive = useRef('')
  const previousBlockages = useRef('[]')

  useEffect(() => {
    current.current = options
  })

  const incidents =
    records.id === simulationId
      ? records.items
      : []

  const summary = getIncidentSummary(
    incidents,
    options.coordinates,
    options.scenarioTime,
  )

  const busy =
    loading
    || savingQuickTest
    || savingManualReport

  const addIncidents = useCallback((
    incoming: Incident[],
    id: string,
  ) => {
    if (current.current.simulationId !== id) return

    setRecords((previous) => ({
      id,
      items: mergeIncidents(
        previous.id === id ? previous.items : [],
        incoming,
      ),
    }))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const id = simulationId

    async function load() {
      setLoading(true)
      setError('')

      return fetchIncidentHistory(
        id,
        getScenarioTime(),
        controller.signal,
      )
    }

    void load()
      .then((history) => {
        if (!controller.signal.aborted) {
          addIncidents(history, id)
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(incidentErrorMessage(caught))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [
    simulationId,
    getScenarioTime,
    reloadKey,
    addIncidents,
  ])

  // El alcance por superficie tiene prioridad sobre los datos
  // peatonales conservados por compatibilidad.
  const published = summary.active
    .map((item) =>
      item.surfaceImpact
        ? { ...item, pedestrianImpact: null }
        : item
    )
    .sort((a, b) => a.id.localeCompare(b.id))

  const activeKey = JSON.stringify(published)

  useEffect(() => {
    const key = `${simulationId}:${activeKey}`

    if (key === previousActive.current) return

    previousActive.current = key
    current.current.onActiveIncidentsChange(published)
  }, [simulationId, activeKey, published])

  const blockages = summary.routeBlockages
    .map(({ id, blockedArea }) => ({
      id,
      blockedArea,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  const blockagesKey = JSON.stringify(blockages)

  useEffect(() => {
    if (previousBlockages.current === blockagesKey) {
      return
    }

    const previous: unknown = JSON.parse(
      previousBlockages.current,
    )

    const known = new Set(
      Array.isArray(previous)
        ? previous.map((item) => JSON.stringify(item))
        : [],
    )

    const requestReplanning = blockages.some(
      (item) => !known.has(JSON.stringify(item)),
    )

    previousBlockages.current = blockagesKey

    current.current.onBlockedAreasChange(
      blockages.map((item) => item.blockedArea),
      { requestReplanning },
    )
  }, [blockagesKey, blockages])

  const refreshHistory = useCallback(async () => {
    const latest = current.current

    const history = await fetchIncidentHistory(
      latest.simulationId,
      latest.getScenarioTime(),
      AbortSignal.timeout(40000),
    )

    addIncidents(history, latest.simulationId)

    if (
      current.current.simulationId
      === latest.simulationId
    ) {
      setError('')
    }
  }, [addIncidents])

  function handleCreatingChange(creating: boolean) {
    setSavingManualReport(creating)
    current.current.onCreatingChange?.(creating)
  }

  async function simulateBlockage() {
    if (
      pending.current
      || busy
      || options.coordinates.length < 2
      || summary.routeBlockages.length
    ) {
      return
    }

    pending.current = true
    setSavingQuickTest(true)
    setError('')

    const latest = current.current

    try {
      latest.onBeforeCreate?.()
      latest.onCreatingChange?.(true)

      const at = latest.getScenarioTime()

      const history = await fetchIncidentHistory(
        latest.simulationId,
        at,
        AbortSignal.timeout(40000),
      )

      addIncidents(history, latest.simulationId)

      if (
        getIncidentSummary(
          history,
          latest.coordinates,
          at,
        ).routeBlockages.length
      ) {
        return
      }

      const incident = await createQuickIncident(
        latest.simulationId,
        at,
        latest.coordinates,
        AbortSignal.timeout(40000),
      )

      addIncidents([incident], latest.simulationId)
    } catch (caught) {
      if (
        current.current.simulationId
        === latest.simulationId
      ) {
        setError(incidentErrorMessage(caught))
      }
    } finally {
      pending.current = false
      setSavingQuickTest(false)
      latest.onCreatingChange?.(false)
    }
  }

  return {
    incidents,
    ...summary,
    loading,
    savingQuickTest,
    busy,
    error,
    refreshHistory,
    handleCreatingChange,
    simulateBlockage,

    reload: () =>
      setReloadKey((key) => key + 1),

    onReported: (incident: Incident) =>
      addIncidents([incident], simulationId),
  }
}