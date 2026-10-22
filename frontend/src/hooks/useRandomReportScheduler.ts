import {
  reportBody,
  advanceReport,
} from '../features/incidents/report-schedule';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  requestRandomReport,
} from '../features/incidents/random-reports-api';

import {
  errorMessage,
} from '../api/client';

import {
  nextReportAt,
} from '../utils/random-report-schedule';

import type {
  Coordinate,
} from '../../../shared/contracts/geography';

import type {
  IncidentDTO as Incident,
} from '../../../shared/contracts/incidents';

export type RandomReportOptions = {
  simulationId: string;
  networkVersion: string;
  scenarioTime: string;
  coordinates: Coordinate[];
  disabled: boolean;
  onReported: (
    incident: Incident,
    onRoute: boolean,
  ) => void;
};

// El calendario pertenece al reloj simulado.
// Un fallo conserva el cuerpo original del reporte.
export function useRandomReportScheduler({
  simulationId,
  networkVersion,
  scenarioTime,
  coordinates,
  disabled,
  onReported,
}: RandomReportOptions) {
  const [generationId] = useState(
    () => crypto.randomUUID(),
  )

  const [enabled, setEnabled] = useState(true)
  const [index, setIndex] = useState(0)
  const [routeCount, setRouteCount] = useState(0)

  const [nextAt, setNextAt] = useState(
    () => nextReportAt(Date.parse(scenarioTime)),
  )


  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  const pendingRef = useRef(false)
  const requestBodyRef = useRef<string | null>(null)

  const controllerRef =
    useRef<AbortController | null>(null)

  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const now = Date.parse(scenarioTime)

    if (
      !enabled
      || disabled
      || coordinates.length < 2
      || error
      || pendingRef.current
      || now < nextAt
    ) {
      return
    }

    pendingRef.current = true
    setSending(true)
    setMessage('')

    // Conserva el contexto original si hay que reintentar.

    requestBodyRef.current = reportBody(
      requestBodyRef.current,
      {
        simulationId,
        generationId,
        index,
        networkVersion,
        nextAt,
        coordinates,
      },
    )


    const serializedBody = requestBodyRef.current
    const controller = new AbortController()
    controllerRef.current = controller

    async function send() {
      try {
        const body = await requestRandomReport(serializedBody, simulationId, controller.signal)
        if (!mountedRef.current || controller.signal.aborted) return

        if (body.status === 'skipped') {
          setMessage(
            'No hay un tramo libre adecuado. Se reintentará en el próximo intervalo.',
          )
        } else {
          onReported(body.incident, body.onRoute)
          setIndex((current) => current + 1)

          if (body.onRoute) {
            setRouteCount((current) => current + 1)
          }
        }

        requestBodyRef.current = null

        // Los intervalos pertenecen al reloj del escenario.
        // Si avanzó de golpe, procesa los eventos vencidos
        // de uno en uno, sin solicitudes simultáneas.
        setNextAt(advanceReport(nextAt))
      } catch (caught) {
        if (
          mountedRef.current
          && !controller.signal.aborted
        ) {
          setError(errorMessage(caught))
        }
      } finally {
        if (controllerRef.current === controller) pendingRef.current = false;

        if (mountedRef.current && controllerRef.current === controller) {
          setSending(false)
        }
      }
    }

    void send()
  }, [
    simulationId,
    generationId,
    index,
    networkVersion,
    scenarioTime,
    coordinates,
    disabled,
    enabled,
    error,
    nextAt,
    retryKey,
    onReported,
  ])



  function toggle(checked: boolean) {
            setEnabled(checked)

            if (
              checked
              && !requestBodyRef.current
            ) {
              setNextAt(
                nextReportAt(Date.parse(scenarioTime)),
              )
            }
  }

  return {
    enabled,
    index,
    routeCount,
    nextAt,
    sending,
    error,
    message,
    toggle,

    retry: () => {
      setError('');
      setRetryKey((current) => current + 1);
    },
  };
}
