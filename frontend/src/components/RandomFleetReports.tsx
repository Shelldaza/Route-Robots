import { requestRandomReport } from '../features/incidents/random-reports-api';
import { errorMessage } from '../api/client';
import type { Coordinate } from '../../../shared/contracts/geography'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type { IncidentDTO as Incident } from '../../../shared/contracts/incidents'

import {
  getIncidentAppearance,
} from '../utils/incident-icons'

import {
  nextReportAt,
} from '../utils/random-report-schedule'

type Props = {
  simulationId: string
  networkVersion: string
  scenarioTime: string
  coordinates: Coordinate[]
  disabled: boolean
  onReported: (incident: Incident) => void
}

type Notice = {
  incident: Incident
  onRoute: boolean
}

function reportText(incident: Incident) {
  const segment =
    incident.pedestrianImpact?.segments[0]

  const point = segment?.coordinates[
    Math.floor(segment.coordinates.length / 2)
  ]

  const location = point
    ? `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`
    : 'la red peatonal'

  const label =
    getIncidentAppearance(incident.type).label

  return (
    `${incident.reporterName ?? 'Robot simulado'} `
    + `informó: ${label}. `
    + `Ubicación aproximada: ${location}.`
  )
}

export default function RandomFleetReports({
  simulationId,
  networkVersion,
  scenarioTime,
  coordinates,
  disabled,
  onReported,
}: Props) {
  const [generationId] = useState(
    () => crypto.randomUUID(),
  )

  const [enabled, setEnabled] = useState(true)
  const [index, setIndex] = useState(0)
  const [routeCount, setRouteCount] = useState(0)

  const [nextAt, setNextAt] = useState(
    () => nextReportAt(Date.parse(scenarioTime)),
  )

  const [notices, setNotices] =
    useState<Notice[]>([])

  const [toast, setToast] =
    useState<Notice | null>(null)

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
    if (!toast) return

    const timer = window.setTimeout(
      () => setToast(null),
      8000,
    )

    return () => window.clearTimeout(timer)
  }, [toast])

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
    requestBodyRef.current ??= JSON.stringify({
      simulationId,
      generationId,
      index,
      networkVersion,
      scenarioTime: new Date(nextAt).toISOString(),
      coordinates,
    })

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
          const notice = {
            incident: body.incident,
            onRoute: body.onRoute,
          }

          onReported(notice.incident)

          setNotices((current) => [
            notice,
            ...current.filter(
              (item) =>
                item.incident.id !== notice.incident.id,
            ),
          ].slice(0, 8))

          setToast(notice)
          setIndex((current) => current + 1)

          if (notice.onRoute) {
            setRouteCount((current) => current + 1)
          }
        }

        requestBodyRef.current = null

        // Los intervalos pertenecen al reloj del escenario.
        // Si avanzó de golpe, procesa los eventos vencidos
        // de uno en uno, sin solicitudes simultáneas.
        setNextAt(nextReportAt(nextAt))
      } catch (caught) {
        if (
          mountedRef.current
          && !controller.signal.aborted
        ) {
          setError(errorMessage(caught))
        }
      } finally {
        pendingRef.current = false

        if (mountedRef.current) {
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

  const seconds = Math.max(
    0,
    Math.ceil(
      (nextAt - Date.parse(scenarioTime)) / 1000,
    ),
  )

  return (
    <div className="random-fleet-reports">
      <h3>Reportes de la flota simulada</h3>

      <p>
        Un reporte cada 2–3 minutos del escenario,
        dentro de 1,2 km del robot. En cada bloque
        de 100 reportes, 15 se ubican sobre el
        recorrido pendiente.
      </p>

      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            const checked = event.target.checked
            setEnabled(checked)

            if (
              checked
              && !requestBodyRef.current
            ) {
              setNextAt(
                nextReportAt(Date.parse(scenarioTime)),
              )
            }
          }}
        />
        Generar reportes automáticamente
      </label>

      <p className="simulation-estimates-note">
        {disabled
          ? 'Generación en espera.'
          : coordinates.length < 2
            ? 'La entrega no tiene recorrido pendiente.'
            : !enabled
              ? 'Generación desactivada.'
              : sending
                ? 'Registrando reporte…'
                : (
                  `Próximo reporte en `
                  + `${Math.floor(seconds / 60)} min `
                  + `${seconds % 60} s simulados.`
                )}
        {' '}
        Reportes registrados: {index}.
        {' '}
        Sobre el recorrido: {routeCount}.
      </p>

      {message && (
        <p role="status">{message}</p>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => {
              setError('')
              setRetryKey((current) => current + 1)
            }}
          >
            Reintentar reporte
          </button>
        </div>
      )}

      <ol className="random-fleet-feed">
        {notices.map(({ incident, onRoute }) => (
          <li key={incident.id}>
            <time dateTime={incident.startsAt}>
              {new Date(
                incident.startsAt,
              ).toLocaleTimeString('es-AR')}
            </time>

            <p>{reportText(incident)}</p>

            <small>
              {onRoute
                ? 'Sobre el recorrido al generar el reporte'
                : 'Fuera del recorrido al generar el reporte'}
              {' · '}
              {incident.effect === 'blockage'
                ? 'Bloqueo'
                : incident.effect === 'caution'
                  ? 'Precaución'
                  : 'Informativo'}
            </small>
          </li>
        ))}
      </ol>

      {toast && (
        <div
          className="random-fleet-toast"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            ×
          </button>

          <strong>
            Nuevo reporte de la flota simulada
          </strong>

          <p>{reportText(toast.incident)}</p>
        </div>
      )}
    </div>
  )
}