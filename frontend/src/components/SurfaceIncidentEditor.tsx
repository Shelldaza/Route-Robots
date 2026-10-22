import {
  useSurfaceIncidentEditor,
} from '../hooks/useSurfaceIncidentEditor'

import type {
  SurfaceEditorProps,
} from '../hooks/useSurfaceIncidentEditor'

import {
  isEffect,
} from '../features/incidents/incident-validation'

import {
  EDITOR_ICONS,
} from './incident-map-editor'

import './SurfaceIncidentEditor.css'

// Presentación del formulario.
// El hook coordina el contexto, la selección, el mapa y el guardado.
export default function SurfaceIncidentEditor(
  props: SurfaceEditorProps,
) {
  const {
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
    saving,
    error,
    message,
    validPreview,
    canSave,
    startEditing,
    save,
    discard,
    changeType,
    changeScope,
    reconnect,
    setEffect,
    setDescription,
    setDuration,
    setMultiple,
  } = useSurfaceIncidentEditor(props)

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
            onChange={(event) =>
              changeType(event.target.value)
            }
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
            onChange={(event) => {
              if (isEffect(event.target.value)) {
                setEffect(event.target.value)
              }
            }}
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
                  const value = event.target.value

                  if (
                    value === 'segment'
                    || value === 'street_section'
                  ) {
                    changeScope(value)
                  }
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
          disabled={!canSave}
        >
          {saving ? 'Guardando…' : 'Crear incidente'}
        </button>

        {selection && !editing && (
          <button
            type="button"
            onClick={discard}
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
          onClick={reconnect}
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