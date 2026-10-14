import './RobotSetupSection.css'

function RobotSetupSection() {
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
          <select id="registered-robot" defaultValue="" disabled>
            <option value="">Seleccionar robot</option>
          </select>
        </div>
      </div>

      <details className="robot-setup-details" open>
        <summary>Registrar un robot</summary>

        <form onSubmit={(event) => event.preventDefault()}>
          <fieldset>
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
            <p>
              ""
            </p>

            <button type="submit" disabled>
              Registrar robot
            </button>
          </div>
        </form>
      </details>
    </section>
  )
}

export default RobotSetupSection