import { errorMessage, fetchJson } from '../api/client.ts';
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import RobotModelForm from './RobotModelForm'
import { DATA_SOURCES, isRobot, isRobotModel, requiredWidth } from '../utils/robot-models';


import type {
  Robot,
  RobotModel,
} from '../utils/robot-models'

import './RobotSetupSection.css'

export type { Robot } from '../utils/robot-models'

type Props = {
  onRobotSelected: (robot: Robot | null) => void
}

function measure(value: number | null): string {
  return value === null
    ? 'Sin información'
    : `${value.toLocaleString('es-AR', {
        maximumFractionDigits: 3,
      })} m`
}

function ModelSummary({ model }: { model: RobotModel }) {
  const width = requiredWidth(model)

  return (
    <div className="robot-model-summary">
      <p>
        <strong>{model.name}</strong>
        {' · '}
        {DATA_SOURCES[model.dataSource]}
      </p>

      <dl>
        <div>
          <dt>Ancho</dt>
          <dd>{measure(model.widthMeters)}</dd>
        </div>

        <div>
          <dt>Largo</dt>
          <dd>{measure(model.lengthMeters)}</dd>
        </div>

        <div>
          <dt>Margen por lado</dt>
          <dd>{measure(model.lateralMarginMeters)}</dd>
        </div>

        <div>
          <dt>Ancho con márgenes</dt>
          <dd>{measure(width)}</dd>
        </div>

        <div>
          <dt>Velocidad</dt>
          <dd>{model.speedKmh} km/h</dd>
        </div>

        <div>
          <dt>Batería</dt>
          <dd>{model.batteryCapacityWh} Wh</dd>
        </div>

        <div>
          <dt>Consumo de referencia</dt>
          <dd>{model.consumptionWhPerKm} Wh/km</dd>
        </div>

        <div>
          <dt>Pendiente máxima</dt>
          <dd>
            {model.maxSlopePercent === null
              ? 'Sin información'
              : `${model.maxSlopePercent} %`}
          </dd>
        </div>
      </dl>

      {model.sourceNotes && (
        <p>
          Fuente y condiciones: {model.sourceNotes}
        </p>
      )}

      <p>
        El ancho con márgenes es una referencia geométrica.
        La evaluación del paso se incorporará al enrutamiento.
      </p>
    </div>
  )
}

export default function RobotSetupSection({
  onRobotSelected,
}: Props) {
  const [robots, setRobots] = useState<Robot[]>([])
  const [models, setModels] = useState<RobotModel[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [modelId, setModelId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const chosenModel = models.find(
    (model) => model.id === modelId,
  )

  const selectedRobot = robots.find(
    (robot) => robot.id === selectedId,
  )

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError('')

      try {
        const [robotList, modelList] = await Promise.all([
          fetchJson('/api/robots', {
            signal: controller.signal,
          }),
          fetchJson('/api/robot-models', {
            signal: controller.signal,
          }),
        ])

        if (
          !Array.isArray(robotList)
          || !robotList.every(isRobot)
          || !Array.isArray(modelList)
          || !modelList.every(isRobotModel)
        ) {
          throw new Error(
            'El servidor devolvió datos de robots o modelos inválidos.',
          )
        }

        if (!controller.signal.aborted) {
          setRobots(robotList)
          setModels(modelList)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  function selectRobot(id: string) {
    setSelectedId(id)

    onRobotSelected(
      robots.find((robot) => robot.id === id) ?? null,
    )
  }

  function addModel(model: RobotModel) {
    setModels((current) => [
      model,
      ...current.filter((item) => item.id !== model.id),
    ].sort((a, b) => a.name.localeCompare(b.name, 'es')))

    setModelId(model.id)
    setSubmitError('')
  }

  async function registerRobot(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (saving || loading || loadError) return

    const form = event.currentTarget

    const name = String(
      new FormData(form).get('name') ?? '',
    ).trim()

    setSubmitError('')
    setSuccess('')

    if (!name || !chosenModel) {
      setSubmitError(
        'Ingresá un identificador y seleccioná un modelo.',
      )

      return
    }

    setSaving(true)

    try {
      const body = await fetchJson('/api/robots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          modelId: chosenModel.id,
        }),
      })

      if (!isRobot(body)) {
        throw new Error(
          'El servidor devolvió un robot inválido.',
        )
      }

      setRobots((current) => [
        body,
        ...current.filter((robot) => robot.id !== body.id),
      ])

      setSelectedId(body.id)
      onRobotSelected(body)

      setSuccess(
        `Robot ${body.name} registrado correctamente.`,
      )

      form.reset()
    } catch (error) {
      setSubmitError(errorMessage(error))
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
          <p className="robot-setup-step">
            PASO 1: ROBOT
          </p>

          <h2 id="robot-setup-title">
            Elegí quién hará el recorrido
          </h2>

          <p>
            Seleccioná una unidad registrada o incorporá una
            a partir de un modelo del catálogo.
          </p>
        </div>

        <div className="robot-setup-selection">
          <label htmlFor="registered-robot">
            Robot registrado
          </label>

          <select
            id="registered-robot"
            value={selectedId}
            onChange={(event) =>
              selectRobot(event.target.value)
            }
            disabled={
              loading
              || saving
              || Boolean(loadError)
              || robots.length === 0
            }
          >
            <option value="">
              {loading ? 'Cargando…' : 'Seleccionar robot'}
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
            disabled={loading || saving}
            onClick={() =>
              setReloadKey((key) => key + 1)
            }
          >
            Reintentar carga
          </button>
        </div>
      )}

      {selectedRobot && (
        <p className="robot-model-help">
          Unidad seleccionada:{' '}
          <strong>{selectedRobot.name}</strong>.
          {' '}Ancho: {measure(selectedRobot.widthMeters)}.
          {' '}Largo: {measure(selectedRobot.lengthMeters)}.
          {' '}Margen por lado:{' '}
          {measure(selectedRobot.lateralMarginMeters)}.
          {' '}
          {selectedRobot.modelId === null
            && 'Registro anterior sin modelo del catálogo; conserva sus capacidades operativas.'}
          {' '}
          {selectedRobot.dataSource
            && `Origen: ${DATA_SOURCES[selectedRobot.dataSource]}.`}
        </p>
      )}

      <details className="robot-setup-details" open>
        <summary>Registrar un robot</summary>

        <form onSubmit={registerRobot}>
          <fieldset
            disabled={
              saving || loading || Boolean(loadError)
            }
          >
            <legend>
              Ingresá el identificador de la unidad y elegí
              su modelo. Ambos campos son obligatorios.
            </legend>

            <div className="robot-setup-fields">
              <label htmlFor="robot-name">
                Nombre o identificador

                <input
                  id="robot-name"
                  name="name"
                  maxLength={80}
                  required
                  placeholder="Ej.: RR-01"
                />
              </label>

              <label htmlFor="robot-model">
                Modelo y configuración

                <select
                  id="robot-model"
                  value={modelId}
                  required
                  onChange={(event) =>
                    setModelId(event.target.value)
                  }
                >
                  <option value="">
                    Seleccionar modelo
                  </option>

                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!loading
              && !loadError
              && models.length === 0
              && (
                <p className="robot-model-help">
                  Primero agregá un modelo usando
                  la sección de abajo.
                </p>
              )}

            {chosenModel && (
              <ModelSummary model={chosenModel} />
            )}
          </fieldset>

          <div className="robot-setup-footer">
            <button
              type="submit"
              disabled={
                saving
                || loading
                || Boolean(loadError)
                || !chosenModel
              }
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

      <RobotModelForm
        onCreated={addModel}
        disabled={
          loading || saving || Boolean(loadError)
        }
      />
    </section>
  )
}