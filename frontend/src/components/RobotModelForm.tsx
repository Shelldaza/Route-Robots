import { errorMessage, fetchJson } from '../api/client.ts';
import { useState } from 'react'
import type { FormEvent } from 'react'
import { DATA_SOURCES, isRobotModel } from '../utils/robot-models';


import type {
  DataSource,
  RobotModel,
} from '../utils/robot-models'

const fields = [
  {
    name: 'speedKmh',
    label: 'Velocidad operativa — km/h',
    required: true,
    min: '0.01',
  },
  {
    name: 'batteryCapacityWh',
    label: 'Capacidad de batería — Wh',
    required: true,
    min: '0.01',
  },
  {
    name: 'consumptionWhPerKm',
    label: 'Consumo de referencia — Wh/km',
    required: true,
    min: '0.01',
  },
  {
    name: 'maxSlopePercent',
    label: 'Pendiente máxima — % (opcional)',
    required: false,
    min: '0',
  },
  {
    name: 'widthMeters',
    label: 'Ancho total — m (opcional)',
    required: false,
    min: '0.001',
  },
  {
    name: 'lengthMeters',
    label: 'Largo total — m (opcional)',
    required: false,
    min: '0.001',
  },
  {
    name: 'lateralMarginMeters',
    label: 'Margen por cada lado — m (opcional)',
    required: false,
    min: '0',
  },
] as const

type Props = {
  onCreated: (model: RobotModel) => void
  disabled: boolean
}

export default function RobotModelForm({
  onCreated,
  disabled,
}: Props) {
  const [source, setSource] = useState<DataSource>('simulated')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const needsNotes =
    source === 'documented' || source === 'measured'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (disabled || saving) return

    const form = event.currentTarget
    const data = new FormData(form)

    const payload: Record<string, unknown> = {
      name: String(data.get('name') ?? '').trim(),
      dataSource: source,
      sourceNotes:
        String(data.get('sourceNotes') ?? '').trim() || null,
    }

    for (const field of fields) {
      const text = String(data.get(field.name) ?? '').trim()

      payload[field.name] =
        text === '' ? null : Number(text)
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const body = await fetchJson('/api/robot-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!isRobotModel(body)) {
        throw new Error(
          'El servidor devolvió un modelo inválido.',
        )
      }

      onCreated(body)

      setSuccess(
        `Modelo ${body.name} guardado. Ya podés seleccionarlo al registrar un robot.`,
      )

      form.reset()
      setSource('simulated')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="robot-setup-details">
      <summary>Agregar un modelo al catálogo</summary>

      <form onSubmit={submit}>
        <fieldset disabled={disabled || saving}>
          <legend>
            Guardá una configuración reutilizable. Dejá vacías
            las medidas que desconocés. Para una configuración
            diferente, creá otra entrada con un nombre distinto.
          </legend>

          <div className="robot-setup-fields">
            <label htmlFor="model-name">
              Nombre del modelo y configuración

              <input
                id="model-name"
                name="name"
                maxLength={80}
                required
                placeholder="Ej.: Robot de prueba · versión 1"
              />
            </label>

            {fields.map((field) => (
              <label
                key={field.name}
                htmlFor={`model-${field.name}`}
              >
                {field.label}

                <input
                  id={`model-${field.name}`}
                  name={field.name}
                  type="number"
                  min={field.min}
                  step="any"
                  required={field.required}
                />
              </label>
            ))}

            <label htmlFor="model-source">
              Origen de los datos

              <select
                id="model-source"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as DataSource)
                }
              >
                {Object.entries(DATA_SOURCES).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label htmlFor="model-source-notes">
              Fuente y condiciones
              {needsNotes ? '' : ' (opcional)'}

              <input
                id="model-source-notes"
                name="sourceNotes"
                maxLength={500}
                required={needsNotes}
                placeholder="Documento, ensayo o supuestos de la simulación"
              />
            </label>
          </div>

          <p className="robot-model-help">
            El ancho incluye salientes. El margen se aplica
            a cada lado del robot. La pendiente se expresa en
            porcentaje. El consumo corresponde a las condiciones
            de referencia indicadas. Usá «Simulado para la demo»
            para valores ficticios.
          </p>
        </fieldset>

        <div className="robot-setup-footer">
          <button
            disabled={disabled || saving}
            type="submit"
          >
            {saving ? 'Guardando…' : 'Guardar modelo'}
          </button>
        </div>

        {error && (
          <p
            className="robot-setup-feedback robot-setup-error"
            role="alert"
          >
            {error}
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
  )
}