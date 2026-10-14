import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './RobotSetupSection.css'

export type Robot = {
  id: string
  name: string
  model: string | null
  speedKmh: number
  batteryCapacityWh: number
  consumptionWhPerKm: number
  maxSlopePercent: number | null
  createdAt: string
}

type Props = {
  onRobotSelected: (robot: Robot | null) => void
}

function isPositiveNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
  )
}

function isRobot(value: unknown): value is Robot {
  if (!value || typeof value !== 'object') return false

  const robot = value as Record<string, unknown>

  return (
    typeof robot.id === 'string' &&
    typeof robot.name === 'string' &&
    (robot.model === null || typeof robot.model === 'string') &&
    isPositiveNumber(robot.speedKmh) &&
    isPositiveNumber(robot.batteryCapacityWh) &&
    isPositiveNumber(robot.consumptionWhPerKm) &&
    (
      robot.maxSlopePercent === null ||
      (
        typeof robot.maxSlopePercent === 'number' &&
        Number.isFinite(robot.maxSlopePercent) &&
        robot.maxSlopePercent >= 0
      )
    ) &&
    typeof robot.createdAt === 'string'
  )
}

async function readResponse(
  response: Response,
  fallback: string,
): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : fallback

    throw new Error(message)
  }

  return body
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'La consulta tardó demasiado. Intentá nuevamente.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}

function RobotSetupSection({ onRobotSelected }: Props) {
  const [robots, setRobots] = useState<Robot[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRobots() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch('/api/robots', {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(40000),
          ]),
        })

        const body = await readResponse(
          response,
          'No se pudieron consultar los robots.',
        )

        if (!Array.isArray(body) || !body.every(isRobot)) {
          throw new Error(
            'El servidor devolvió una lista de robots inválida.',
          )
        }

        if (!controller.signal.aborted) {
          setRobots(body)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadRobots()

    return () => {
      controller.abort()
    }
  }, [reloadKey])

  function selectRobot(id: string) {
    setSelectedId(id)

    const robot = robots.find((item) => item.id === id) ?? null
    onRobotSelected(robot)
  }

  async function registerRobot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || loading || loadError) return

    const form = event.currentTarget
    const data = new FormData(form)

    const name = String(data.get('name') ?? '').trim()
    const model = String(data.get('model') ?? '').trim()
    const slope = String(data.get('maxSlopePercent') ?? '').trim()

    setSubmitError('')
    setSuccess('')

    if (!name) {
      setSubmitError('Ingresá un nombre o identificador para el robot.')
      return
    }

    const payload = {
      name,
      model: model || null,
      speedKmh: Number(data.get('speedKmh')),
      batteryCapacityWh: Number(data.get('batteryCapacityWh')),
      consumptionWhPerKm: Number(data.get('consumptionWhPerKm')),
      maxSlopePercent: slope === '' ? null : Number(slope),
    }

    setSaving(true)

    try {
      const response = await fetch('/api/robots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(40000),
      })

      const body = await readResponse(
        response,
        'No se pudo registrar el robot.',
      )

      if (!isRobot(body)) {
        throw new Error(
          'El servidor devolvió un robot con datos inválidos.',
        )
      }

      setRobots((current) => [
        body,
        ...current.filter((robot) => robot.id !== body.id),
      ])

      setSelectedId(body.id)
      onRobotSelected(body)
      setSuccess(`Robot ${body.name} registrado correctamente.`)
      form.reset()
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className="robot-setup"
      aria-labelledby="robot-setup-title"
    >
      <div className="robot-setup-heading">
        <div>
          <p className="robot-setup-step">PASO 1: ROBOT</p>
          <h2 id="robot-setup-title">Elegí quién hará el recorrido</h2>
          <p>
            Usá un robot registrado o incorporá uno con sus
            capacidades operativas.
          </p>
        </div>

        <div className="robot-setup-selection">
          <label htmlFor="registered-robot">Robot registrado</label>

          <select
            id="registered-robot"
            value={selectedId}
            onChange={(event) => selectRobot(event.target.value)}
            disabled={
              loading ||
              saving ||
              Boolean(loadError) ||
              robots.length === 0
            }
          >
            <option value="">
              {loading
                ? 'Cargando robots…'
                : loadError
                  ? 'Lista no disponible'
                  : robots.length === 0
                    ? 'Todavía no hay robots registrados'
                    : 'Seleccionar robot'}
            </option>

            {robots.map((robot) => (
              <option key={robot.id} value={robot.id}>
                {robot.name}
                {robot.model ? ` · ${robot.model}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="robot-setup-feedback robot-setup-error">
          <p role="alert">{loadError}</p>
          <button
            className="robot-setup-retry"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={loading || saving}
          >
            Reintentar carga
          </button>
        </div>
      )}

      <details className="robot-setup-details" open>
        <summary>Registrar un robot</summary>

        <form onSubmit={registerRobot}>
          <fieldset disabled={saving}>
            <legend>
              Identificación y capacidades. Todos los campos son
              obligatorios salvo los indicados como opcionales.
            </legend>

            <div className="robot-setup-fields">
              <label htmlFor="robot-name">
                Nombre o identificador
                <input
                  id="robot-name"
                  name="name"
                  type="text"
                  placeholder="Ej.: RR-01"
                  maxLength={80}
                  required
                />
              </label>

              <label htmlFor="robot-model">
                Modelo (opcional)
                <input
                  id="robot-model"
                  name="model"
                  type="text"
                  placeholder="Modelo del robot"
                  maxLength={80}
                />
              </label>

              <label htmlFor="robot-speed">
                Velocidad operativa - km/h
                <input
                  id="robot-speed"
                  name="speedKmh"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                />
              </label>

              <label htmlFor="robot-battery-capacity">
                Capacidad de batería - Wh
                <input
                  id="robot-battery-capacity"
                  name="batteryCapacityWh"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </label>

              <label htmlFor="robot-consumption">
                Consumo de referencia - Wh/km
                <input
                  id="robot-consumption"
                  name="consumptionWhPerKm"
                  type="number"
                  min="0.1"
                  step="0.1"
                  aria-describedby="robot-consumption-help"
                  required
                />
                <small id="robot-consumption-help">
                  Usá un valor medido o documentado para condiciones
                  de referencia.
                </small>
              </label>

              <label htmlFor="robot-slope">
                Pendiente máxima — % (opcional)
                <input
                  id="robot-slope"
                  name="maxSlopePercent"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-describedby="robot-slope-help"
                />
                <small id="robot-slope-help">
                  Dejalo vacío si desconocés el límite. Se expresa
                  en porcentaje, no en grados.
                </small>
              </label>
            </div>
          </fieldset>

          <div className="robot-setup-footer">
            <button
              type="submit"
              disabled={saving || loading || Boolean(loadError)}
            >
              {saving ? 'Registrando…' : 'Registrar robot'}
            </button>
          </div>

          {submitError && (
            <p
              className="robot-setup-feedback robot-setup-error"
              role="alert"
            >
              {submitError}
            </p>
          )}

          {success && (
            <p
              className="robot-setup-feedback robot-setup-success"
              role="status"
            >
              {success}
            </p>
          )}
        </form>
      </details>
    </section>
  )
}

export default RobotSetupSection