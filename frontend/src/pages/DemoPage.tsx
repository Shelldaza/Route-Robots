import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './DemoPage.css'
import RobotSetupSection from '../components/RobotSetupSection'
import type { Robot } from '../components/RobotSetupSection'
import { drawPedestrianNetwork, fetchPedestrianNetwork } from '../utils/pedestrian-network'
import type { PedestrianNetwork } from '../utils/pedestrian-network'
import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'

function DemoPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  const [network, setNetwork] = useState<PedestrianNetwork | null>(null)
  const [networkError, setNetworkError] = useState('')
  const [pedestrianMode, setPedestrianMode] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    void fetchPedestrianNetwork(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((value) => { if (!controller.signal.aborted) setNetwork(value) })
      .catch(() => { if (!controller.signal.aborted) setNetworkError('No se pudo cargar el sandbox. Recargá la página para reintentar.') })
    return () => controller.abort()
  }, [])

  const [points, setPoints] = useState<L.LatLngLiteral[]>([])
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current).setView(
      [38.9072, -77.0369],
      14,
    )

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    if (pedestrianMode && network) {
      drawPedestrianNetwork(map, network)

      const { south, west, north, east } = network.bounds

      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [20, 20] },
      )
    }
    markersRef.current = L.layerGroup().addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      const point = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      }

      setPoints((current) =>
        current.length < 2 ? [...current, point] : current,
      )
    })

    return () => {
      map.remove()
      markersRef.current = null
    }
  }, [network, pedestrianMode])

  useEffect(() => {
    const markers = markersRef.current
    if (!markers) return

    markers.clearLayers()

    points.forEach((point, index) => {
      const name = index === 0 ? 'Origen' : 'Destino'
      const color = index === 0 ? '#15803d' : '#2563eb'

      L.circleMarker(point, {
        radius: 9,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(name, {
          permanent: true,
          direction: 'top',
        })
        .addTo(markers)
    })
  }, [points, network, pedestrianMode])

  function continueToSimulation() {
    const origin = points[0]
    const destination = points[1]

    if (!selectedRobot || !origin || !destination) return

    navigate('/simulacion', {
      state: {
        robot: selectedRobot,
        origin,
        destination,
        ...(pedestrianMode && network ? { networkVersion: network.version } : {}),
      },
    })
  }

  const canContinue = selectedRobot !== null && points.length === 2 && (!pedestrianMode || network !== null)

  const instruction =
    points.length === 0
      ? 'Hacé clic en el mapa para elegir el origen.'
      : points.length === 1
        ? 'Ahora elegí el destino con otro clic.'
        : 'Origen y destino seleccionados.'

  return (
    <div className="demo-page">
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

            <Link
              className="demo-nav-button"
              to="/demo"
              aria-current="page"
            >
              Abrir demo <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="workspace">
        <div className="demo-heading">
          <h1>Preparar entrega</h1>
          <p>
            Configurá el robot y elegí los puntos de salida y llegada
            en Washington D. C.
          </p>
        </div>

        <RobotSetupSection onRobotSelected={setSelectedRobot} />

        {selectedRobot && (
          <p className="demo-robot-summary" role="status">
            Robot seleccionado: <strong>{selectedRobot.name}</strong>
          </p>
        )}

        <section
          className="route-setup"
          aria-labelledby="route-setup-title"
        >
          <div className="route-setup-heading">
            <p className="route-setup-step">PASO 2: RECORRIDO</p>
            <h2 id="route-setup-title">Elegí el origen y el destino</h2>
            <p>
              Marcá los dos puntos en el mapa. La ruta se calculará
              al continuar a la simulación.
            </p>
          </div>

          <div className="layout">
            <aside className="panel" aria-label="Puntos del recorrido">
              <label>
                <input type="checkbox" checked={pedestrianMode} onChange={(event) => {
                  setPedestrianMode(event.target.checked); setPoints([])
                }} />
                Sandbox de veredas y cruces
              </label>
              {pedestrianMode && <p role="status">{networkError || (network
                ? 'Elegí puntos sobre las líneas violetas (veredas y caminos) y naranjas (cruces). Los desvíos usan únicamente esta red.'
                : 'Cargando red peatonal…')}</p>}
              <p role="status">{instruction}</p>

              {['Origen', 'Destino'].map((label, index) => {
                const point = points[index]

                return (
                  <div className="point" key={label}>
                    <strong>{label}</strong>
                    <span>
                      {point
                        ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                        : 'Sin seleccionar'}
                    </span>
                  </div>
                )
              })}

              <button
                type="button"
                className="secondary"
                onClick={() => setPoints([])}
                disabled={points.length === 0}
              >
                Reiniciar selección
              </button>

              <p className="note">
                Seleccioná puntos sobre calles o caminos cercanos.
                Usamos rutas peatonales como base del prototipo.
              </p>
            </aside>

            <div
              className="map"
              ref={containerRef}
              aria-label="Mapa para seleccionar origen y destino"
            />
          </div>

          <div className="route-setup-footer">
            <p id="simulation-requirements" role="status">
              {!selectedRobot
                ? 'Seleccioná un robot en el paso 1 para continuar.'
                : points.length !== 2
                  ? 'Seleccioná el origen y el destino para continuar.'
                  : `Todo listo para preparar el recorrido de ${selectedRobot.name}.`}
            </p>

            <button
              type="button"
              onClick={continueToSimulation}
              disabled={!canContinue}
              aria-describedby="simulation-requirements"
            >
              Continuar a simulación →
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DemoPage