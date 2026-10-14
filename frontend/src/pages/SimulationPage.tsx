import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'
import './DemoPage.css'
import './SimulationPage.css'

type RouteResponse = {
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  distanceMeters: number
  durationSeconds: number
  profile: string
}

function isRouteResponse(value: unknown): value is RouteResponse {
  if (!value || typeof value !== 'object') return false

  const route = value as Record<string, unknown>
  const geometry = route.geometry

  if (!geometry || typeof geometry !== 'object') return false

  const shape = geometry as Record<string, unknown>

  return (
    shape.type === 'LineString' &&
    Array.isArray(shape.coordinates) &&
    shape.coordinates.length >= 2 &&
    shape.coordinates.every(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        Number.isFinite(point[0]) &&
        point[0] >= -180 &&
        point[0] <= 180 &&
        typeof point[1] === 'number' &&
        Number.isFinite(point[1]) &&
        point[1] >= -90 &&
        point[1] <= 90,
    ) &&
    typeof route.distanceMeters === 'number' &&
    Number.isFinite(route.distanceMeters) &&
    route.distanceMeters >= 0 &&
    typeof route.durationSeconds === 'number' &&
    Number.isFinite(route.durationSeconds) &&
    route.durationSeconds >= 0 &&
    typeof route.profile === 'string'
  )
}

function SimulationPage() {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  const navigationState: unknown = location.state

  const receivedRoute =
    navigationState &&
    typeof navigationState === 'object' &&
    'route' in navigationState
      ? navigationState.route
      : null

  const route = isRouteResponse(receivedRoute)
    ? receivedRoute
    : null

  useEffect(() => {
    if (!containerRef.current || !route) return

    const positions: L.LatLngTuple[] =
      route.geometry.coordinates.map(([lng, lat]) => [lat, lng])

    const origin = positions[0]
    const destination = positions[positions.length - 1]

    if (!origin || !destination) return

    const map = L.map(containerRef.current).setView(origin, 15)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const line = L.polyline(positions, {
      color: '#0f766e',
      weight: 5,
      opacity: 0.9,
    }).addTo(map)

    L.circleMarker(origin, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#15803d',
      fillOpacity: 1,
    })
      .bindTooltip('Origen', {
        permanent: true,
        direction: 'top',
      })
      .addTo(map)

    L.circleMarker(destination, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#2563eb',
      fillOpacity: 1,
    })
      .bindTooltip('Destino', {
        permanent: true,
        direction: 'top',
      })
      .addTo(map)

    map.fitBounds(line.getBounds(), {
      padding: [40, 40],
      maxZoom: 17,
    })

    return () => {
      map.remove()
    }
  }, [route])

  return (
    <div className="demo-page simulation-page">
      <header className="demo-header">
        <div className="demo-nav-wrap">
          <Link
            className="demo-brand"
            to="/"
            aria-label="RouteRobots — Inicio"
          >
            <img
              className="demo-brand-robot"
              src={robotLogo}
              alt=""
            />
            <img
              className="demo-brand-name"
              src={brandName}
              alt=""
            />
          </Link>

          <nav className="demo-nav" aria-label="Principal">
            <Link to="/">Plataforma</Link>

            <Link className="demo-nav-button" to="/demo">
              Configurar otra entrega
              <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="simulation-workspace">
        {!route ? (
          <section className="simulation-empty">
            <h1>Primero prepará un recorrido</h1>
            <p>
              Seleccioná el origen y el destino en la demo y calculá
              una ruta para abrir su seguimiento.
            </p>
            <Link to="/demo">Ir a preparar entrega →</Link>
          </section>
        ) : (
          <>
            <div className="simulation-heading">
              <div>
                <p className="simulation-eyebrow">
                  SEGUIMIENTO DE ENTREGA
                </p>
                <h1>El recorrido y sus decisiones</h1>
                <p>Área de prueba: Washington D. C.</p>
              </div>

              <span className="simulation-state">
                Ruta recibida
              </span>
            </div>

            <div className="simulation-toolbar">
              <div className="simulation-clock">
                <span>Tiempo del escenario</span>
                <strong>Sin iniciar</strong>
              </div>

              <div className="simulation-controls">
                <button type="button" disabled>
                  Iniciar
                </button>

                <label htmlFor="simulation-speed">
                  Velocidad
                  <select
                    id="simulation-speed"
                    defaultValue="1"
                    disabled
                  >
                    <option value="1">×1</option>
                    <option value="10">×10</option>
                    <option value="60">×60</option>
                  </select>
                </label>

                <button type="button" disabled>
                  +2 minutos
                </button>

                <button type="button" disabled>
                  +11 días
                </button>
              </div>
            </div>

            <p className="simulation-notice">
              El recorrido proviene del backend. El movimiento y la
              gestión de eventos todavía no están disponibles.
            </p>

            <div className="simulation-grid">
              <section
                className="simulation-map-panel"
                aria-labelledby="simulation-route-title"
              >
                <div className="simulation-panel-heading">
                  <h2 id="simulation-route-title">
                    Recorrido calculado
                  </h2>
                  <span>Sin iniciar</span>
                </div>

                <div
                  className="simulation-map"
                  ref={containerRef}
                  aria-label="Mapa del recorrido calculado"
                />

                <div
                  className="simulation-legend"
                  aria-label="Referencias del mapa"
                >
                  <span>
                    <i className="legend-origin" aria-hidden="true" />
                    Origen
                  </span>
                  <span>
                    <i
                      className="legend-destination"
                      aria-hidden="true"
                    />
                    Destino
                  </span>
                  <span>
                    <i className="legend-route" aria-hidden="true" />
                    Ruta calculada
                  </span>
                </div>

                <dl className="simulation-metrics">
                  <div>
                    <dt>Distancia</dt>
                    <dd>
                      {route.distanceMeters.toLocaleString('es-AR', {
                        maximumFractionDigits: 1,
                      })}{' '}
                      m
                    </dd>
                  </div>

                  <div>
                    <dt>Tiempo peatonal de referencia</dt>
                    <dd>
                      {(route.durationSeconds / 60).toLocaleString(
                        'es-AR',
                        { maximumFractionDigits: 1 },
                      )}{' '}
                      min
                    </dd>
                  </div>

                  <div>
                    <dt>Consumo estimado</dt>
                    <dd>—</dd>
                  </div>

                  <div>
                    <dt>Batería al llegar</dt>
                    <dd>—</dd>
                  </div>
                </dl>
              </section>

              <aside className="simulation-side">
                <section className="simulation-card">
                  <p className="simulation-eyebrow">
                    EVALUACIÓN DEL RECORRIDO
                  </p>
                  <h2>Evaluación pendiente</h2>
                  <p>
                    La ruta está calculada. Falta asociar el robot
                    y evaluar las condiciones del entorno antes de
                    determinar su aptitud.
                  </p>

                  <dl className="simulation-checks">
                    <div>
                      <dt>Robot</dt>
                      <dd>Sin asociar</dd>
                    </div>
                    <div>
                      <dt>Energía disponible</dt>
                      <dd>Sin evaluar</dd>
                    </div>
                    <div>
                      <dt>Pendientes</dt>
                      <dd>Sin verificar</dd>
                    </div>
                    <div>
                      <dt>Incidentes</dt>
                      <dd>Sin consultar</dd>
                    </div>
                  </dl>
                </section>

                <section className="simulation-card">
                  <h2>Actividad del sistema</h2>
                  <ol className="simulation-activity">
                    <li>
                      Se recibió el recorrido calculado desde la
                      preparación de la entrega.
                    </li>
                  </ol>
                </section>
              </aside>
            </div>

            <section className="simulation-card simulation-incidents">
              <h2>Incidentes del recorrido</h2>
              <p>
                Los reportes aparecerán aquí cuando conectemos la
                consulta de incidentes y los eventos de los robots.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default SimulationPage