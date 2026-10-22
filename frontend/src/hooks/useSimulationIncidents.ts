import {
  LatestRead,
} from '../../../shared/async/latest-read.ts';
import type {
  IncidentSummaryDTO,
} from '../../../shared/contracts/incidents';
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
  fetchIncidentSnapshot,
  incidentErrorMessage,
} from '../features/incidents/incident-api.ts'

import {
  getIncidentSummary,
  getIncidentStatus,
  mergeIncidents,
} from '../features/incidents/incident-rules.ts'


const publishedIncidents = new WeakMap<
  Incident,
  Incident
>();

function publishIncident(item: Incident): Incident {
  if (!item.surfaceImpact) return item;

  let value = publishedIncidents.get(item);

  if (!value) {
    value = {
      ...item,
      pedestrianImpact: null,
    };

    publishedIncidents.set(item, value);
  }

  return value;
}

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

  const [timeline, setTimeline] = useState<{
    id: string;
    items: IncidentSummaryDTO[];
  }>({
    id: simulationId,
    items: [],
  });

  const [loading, setLoading] = useState(true)
  const [savingQuickTest, setSavingQuickTest] = useState(false)
  const [savingManualReport, setSavingManualReport] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const initialized = useRef('');

  const reads = useRef(new LatestRead());

  const operations = useRef(
    new Set<AbortController>(),
  );

  const pending = useRef(false)
  const current = useRef(options)
  const previousActive = useRef<{
    id: string;
    items: Incident[];
  }>({ id: '', items: [] });

  const previousBlockages = useRef(
    new Map<string, Incident>(),
  );

  useEffect(() => {
    const active = operations.current;
    const reader = reads.current;

    return () => {
      reader.cancel();

      for (const controller of active) {
        controller.abort();
      }

      active.clear();
    };
  }, [simulationId]);

  useEffect(() => {
    current.current = options
  })

  const incidents =
    records.id === simulationId
      ? records.items
      : []

  const history =
    timeline.id === simulationId
      ? timeline.items
      : [];

  const activeIds = history
    .filter(
      (item) =>
        getIncidentStatus(
          item,
          Date.parse(options.scenarioTime),
        ) === 'active'
        && !incidents.some(
          (record) => record.id === item.id,
        ),
    )
    .map((item) => item.id)
    .sort()
    .join(':')

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

  const replaceActive = useCallback(
    (incoming: Incident[], id: string) => {
      if (current.current.simulationId !== id) return;

      setRecords((previous) => ({
        id,
        items: mergeIncidents(
          previous.id === id
            ? previous.items
            : [],
          incoming,
        ).filter(
          (item) => incoming.some(
            (record) => record.id === item.id,
          ),
        ),
      }));
    },
    [],
  );

  useEffect(() => {
    const loadKey = simulationId + ':' + reloadKey;

    if (!activeIds && initialized.current === loadKey) {
      return;
    }

    const controller = reads.current.start()
    const id = simulationId

    async function load() {
      setLoading(true)
      setError('')

      return fetchIncidentSnapshot(
        id,
        getScenarioTime(),
        controller.signal,
      )
    }

    void load()
      .then((history) => {
        if (!controller.signal.aborted) {
          initialized.current = loadKey;
          replaceActive(history.active, id);
          setTimeline({
            id,
            items: history.history,
          });
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
    replaceActive,
    activeIds,
  ])

  // El alcance por superficie tiene prioridad sobre los datos
  // peatonales conservados por compatibilidad.
  const published = summary.active
    .map((item) =>
      publishIncident(item)
    )
    .sort((a, b) => a.id.localeCompare(b.id))


  useEffect(() => {
    const previous = previousActive.current;

    if (
      previous.id === simulationId
      && previous.items.length === published.length
      && published.every(
        (item, index) => item === previous.items[index],
      )
    ) {
      return;
    }

    previousActive.current = {
      id: simulationId,
      items: published,
    };

    current.current.onActiveIncidentsChange(published);
  }, [simulationId, published]);

  useEffect(() => {
    const next = new Map(
      summary.routeBlockages.map(
        (item) => [item.id, item],
      ),
    );

    const previous = previousBlockages.current;

    const same =
      next.size === previous.size
      && [...next].every(
        ([id, item]) => item === previous.get(id),
      );

    if (same) return;

    const requestReplanning = [...next].some(
      ([id, item]) => item !== previous.get(id),
    );

    previousBlockages.current = next;

    current.current.onBlockedAreasChange(
      [...next.values()].map(
        (item) => item.blockedArea,
      ),
      { requestReplanning },
    );
  }, [summary.routeBlockages]);

  const refreshHistory = useCallback(async () => {
    const latest = current.current

    const reader = reads.current;
    const controller = reader.start();

    setLoading(true);
    operations.current.add(controller);

    try {
    const history = await fetchIncidentSnapshot(
      latest.simulationId,
      latest.getScenarioTime(),
      controller.signal,
    )

    controller.signal.throwIfAborted();

    replaceActive(history.active, latest.simulationId);

    setTimeline({
      id: latest.simulationId,
      items: history.history,
    });

    if (
      current.current.simulationId
      === latest.simulationId
    ) {
      setError('')
    }
    } finally {
      operations.current.delete(controller);

      if (reader.isCurrent(controller)) {
        setLoading(false);
      }
    }
  }, [replaceActive])

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

    const latest = current.current;
    const controller = new AbortController();

    operations.current.add(controller);

    try {
      latest.onBeforeCreate?.()
      latest.onCreatingChange?.(true)

      const at = latest.getScenarioTime()

      const snapshot = await fetchIncidentSnapshot(
        latest.simulationId,
        at,
        controller.signal,
      )

      controller.signal.throwIfAborted();

      const history = snapshot.active;

      replaceActive(history, latest.simulationId);

      setTimeline({
        id: latest.simulationId,
        items: snapshot.history,
      });

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
        controller.signal,
      )

      controller.signal.throwIfAborted();
      addIncidents([incident], latest.simulationId);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      if (
        !controller.signal.aborted
        && current.current.simulationId
        === latest.simulationId
      ) {
        setError(incidentErrorMessage(caught))
      }
    } finally {
      operations.current.delete(controller);
      pending.current = false
      setSavingQuickTest(false)
      latest.onCreatingChange?.(false)
    }
  }

  return {
    incidents: history,
    ...summary,

    finished: history.filter(
      (item) =>
        getIncidentStatus(item, summary.nowMs)
        === 'finished',
    ).length,

    scheduled: history.filter(
      (item) =>
        getIncidentStatus(item, summary.nowMs)
        === 'scheduled',
    ).length,
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
      {
        addIncidents([incident], simulationId);
        setReloadKey((key) => key + 1);
      },
  }
}
