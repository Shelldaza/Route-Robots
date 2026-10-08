import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './DemoPage.css'
import { Link } from 'react-router'

type RouteResponse = {
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  distanceMeters: number
  durationSeconds: number
  profile: string
}

function DemoPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)

  const [points, setPoints] = useState<L.LatLngLiteral[]>([])
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    mapRef.current = map
    markersRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)

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
      mapRef.current = null
      markersRef.current = null
      routeLayerRef.current = null
    }
  }, [])

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
  }, [points])

  useEffect(() => {
    const map = mapRef.current
    const routeLayer = routeLayerRef.current

    if (!map || !routeLayer) return

    routeLayer.clearLayers()

    if (!route) return

    // La API devuelve [longitud, latitud].
    // Leaflet necesita [latitud, longitud].
    const coordinates: L.LatLngTuple[] =
      route.geometry.coordinates.map(([lng, lat]) => [lat, lng])

    const line = L.polyline(coordinates, {
      color: '#0f766e',
      weight: 6,
      opacity: 0.9,
    }).addTo(routeLayer)

    map.fitBounds(line.getBounds(), {
      padding: [35, 35],
      maxZoom: 17,
    })
  }, [route])

  async function calculateRoute() {
    const origin = points[0]
    const destination = points[1]

    if (!origin || !destination || loading) return

    setLoading(true)
    setError('')
    setRoute(null)

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ origin, destination }),
        signal: AbortSignal.timeout(25000),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null

        throw new Error(
          body?.message ?? 'No se pudo calcular la ruta.',
        )
      }

      const data = (await response.json()) as RouteResponse

      if (
        data.geometry?.type !== 'LineString' ||
        !Array.isArray(data.geometry.coordinates) ||
        data.geometry.coordinates.length < 2 ||
        !Number.isFinite(data.distanceMeters) ||
        !Number.isFinite(data.durationSeconds)
      ) {
        throw new Error('El servidor devolvió una ruta inválida.')
      }

      setRoute(data)
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'TimeoutError') {
        setError('El cálculo tardó demasiado. Intentá nuevamente.')
      } else if (caught instanceof TypeError) {
        setError(
          'No se pudo conectar con el backend. Verificá que esté ejecutándose.',
        )
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Ocurrió un error al calcular la ruta.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  function resetSelection() {
    setPoints([])
    setRoute(null)
    setError('')
  }

  const instruction =
    points.length === 0
      ? 'Hacé clic en el mapa para elegir el origen.'
      : points.length === 1
        ? 'Ahora elegí el destino con otro clic.'
        : 'Origen y destino seleccionados. Podés calcular la ruta.'

  return (
    <main className="workspace">
      <Link to="/">← Volver al inicio</Link>

      <header className="header">
        <div>
          <p className="brand">RouteRobots</p>
          <h1>Planificación de rutas</h1>
          <p>Área de prueba: Washington D. C.</p>
        </div>

        <span className="badge">Prototipo</span>
      </header>

      <div className="layout">
        <aside className="panel">
          <h2>Seleccionar recorrido</h2>
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
            onClick={calculateRoute}
            disabled={points.length !== 2 || loading}
          >
            {loading ? 'Calculando…' : 'Calcular ruta'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={resetSelection}
            disabled={points.length === 0 || loading}
          >
            Reiniciar selección
          </button>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {route && (
            <div className="route-result" role="status">
              <h3>Ruta calculada</h3>
              <p>
                <strong>Distancia:</strong>{' '}
                {route.distanceMeters.toLocaleString('es-AR', {
                  maximumFractionDigits: 1,
                })}{' '}
                metros
              </p>
              <p>
                <strong>Tiempo peatonal de referencia:</strong>{' '}
                {(route.durationSeconds / 60).toLocaleString('es-AR', {
                  maximumFractionDigits: 1,
                })}{' '}
                minutos
              </p>
            </div>
          )}

          <p className="note">
            Seleccioná dos puntos sobre calles o caminos cercanos.
            Por ahora usamos rutas peatonales como base del prototipo.
          </p>
        </aside>

        <div
          className="map"
          ref={containerRef}
          aria-label="Mapa para seleccionar origen y destino"
        />
      </div>
    </main>
  )
}

export default DemoPage