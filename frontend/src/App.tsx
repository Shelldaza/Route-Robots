import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  const [points, setPoints] = useState<L.LatLngLiteral[]>([])

  // Crear el mapa al abrir la pantalla.
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

    markersRef.current = L.layerGroup().addTo(map)

    // Primer clic: origen. Segundo clic: destino.
    map.on('click', (event: L.LeafletMouseEvent) => {
      const point = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      }

      setPoints((current) =>
        current.length < 2 ? [...current, point] : current,
      )
    })

    // Limpiar el mapa cuando se desmonta el componente.
    return () => {
      map.remove()
      markersRef.current = null
    }
  }, [])

  // Actualizar los marcadores cuando cambia la selección.
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

  const instruction =
    points.length === 0
      ? 'Hacé clic en el mapa para elegir el origen.'
      : points.length === 1
        ? 'Ahora elegí el destino con otro clic.'
        : 'Origen y destino seleccionados.'

  return (
    <main className="workspace">
      <header className="header">
        <div>
          <p className="brand">RouteRobots</p>
          <h1>Planificación de rutas</h1>
          <p>Área de prueba: Washington D. C.</p>
        </div>

        <span className="badge">Demo</span>
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
            onClick={() => setPoints([])}
            disabled={points.length === 0}
          >
            Reiniciar selección
          </button>

          <p className="note">
            Seleccioná dos puntos sobre calles o caminos cercanos.
            El cálculo de la ruta se incorporará en el siguiente paso.
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

export default App