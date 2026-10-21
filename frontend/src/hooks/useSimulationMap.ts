import { useCallback, useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type {
  Coordinate,
  RouteResponse,
} from '../../../shared/contracts/routing'

import type {
  Incident,
} from '../components/SimulationIncidentSection'

import type {
  PedestrianNetwork,
} from '../utils/pedestrian-network'

import {
  drawPedestrianNetwork,
} from '../utils/pedestrian-network'

import {
  getIncidentAppearance,
} from '../utils/incident-icons'

import robotLogo from '../assets/robot-logo.jpg'

type MapMotion = {
  position: Coordinate | null
  remainingCoordinates: Coordinate[]
  traveledMeters: number
  status: 'empty' | 'ready' | 'running' | 'paused' | 'completed'
}

type Options = {
  route: RouteResponse | null
  alternative: RouteResponse | null
  network: PedestrianNetwork | null
  motion: MapMotion
  activeIncidents: Incident[]
}

// Este hook representa datos en Leaflet. No calcula rutas, no mueve el robot
// y no decide qué incidentes bloquean: esas responsabilidades siguen fuera.
export function useSimulationMap({
  route,
  alternative,
  network,
  motion,
  activeIncidents,
}: Options) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [incidentMap, setIncidentMap] =
    useState<L.Map | null>(null)

  // Leaflet conserva objetos mutables fuera del árbol de React.
  // Las referencias permiten actualizarlos sin recrearlos en cada render.
  const blockedLayerRef = useRef<L.LayerGroup | null>(null)
  const robotMarkerRef = useRef<L.Marker | null>(null)
  const remainingRouteRef = useRef<L.Polyline | null>(null)
  const originMarkerRef = useRef<L.CircleMarker | null>(null)

  // La ruta base determina la vida del mapa. Un desvío actualiza las capas
  // sin desmontar Leaflet ni desconectar el editor que comparte esta instancia.
  useEffect(() => {
    if (!containerRef.current || !route) return

    // GeoJSON usa [longitud, latitud]; Leaflet recibe [latitud, longitud].
    const positions: L.LatLngTuple[] =
      route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng],
      )

    const origin = positions[0]
    const destination = positions[positions.length - 1]

    if (!origin || !destination) return

    const map = L.map(
      containerRef.current,
      {
        maxZoom: 22,
      },
    ).setView(origin, 15)

    setIncidentMap(map)

    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map)

    remainingRouteRef.current = L.polyline(
      [],
      {
        color: '#0f766e',
        weight: 6,
        opacity: 0.95,

        // El clic atraviesa el recorrido y llega al editor.
        interactive: false,
      },
    ).addTo(map)

    originMarkerRef.current = L.circleMarker(
      origin,
      {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#15803d',
        fillOpacity: 1,
      },
    )
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

    const robotIcon = L.icon({
      iconUrl: robotLogo,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: 'simulation-robot-icon',
    })

    robotMarkerRef.current = L.marker(
      origin,
      {
        icon: robotIcon,
        alt: 'Robot simulado',
        title: 'Robot simulado',
        zIndexOffset: 1000,
      },
    )
      .bindTooltip('Robot simulado')
      .addTo(map)

    blockedLayerRef.current =
      L.layerGroup().addTo(map)

    // El encuadre inicial se establece una sola vez por ruta base.
    // Evaluar un desvío no vuelve a alejar el mapa.
    map.fitBounds(L.latLngBounds(positions), {
      padding: [40, 40],
      maxZoom: 17,
    })

    return () => {
      setIncidentMap(null)

      remainingRouteRef.current = null
      originMarkerRef.current = null
      robotMarkerRef.current = null
      blockedLayerRef.current = null

      // Leaflet elimina sus capas y sus interacciones con el contenedor.
      map.remove()
    }
  }, [route])

  useEffect(() => {
    if (!incidentMap || !network) return

    // Los caminos permanecen visibles aunque no estemos editando.
    // drawPedestrianNetwork conserva su carga por zona y nivel de zoom.
    const layer = drawPedestrianNetwork(
      incidentMap,
      network,
    )

    return () => {
      // La capa también cancela sus consultas y retira sus listeners.
      layer.remove()
    }
  }, [incidentMap, network])

  useEffect(() => {
    // También dependemos de incidentMap: si la ruta llegó de forma asíncrona,
    // sincronizamos la posición al terminar de crear el mapa.
    //
    // Actualizamos las capas existentes. Reconstruir el mapa por fotograma
    // haría perder el encuadre y las interacciones del usuario.
    if (motion.position) {
      const [lng, lat] = motion.position

      robotMarkerRef.current?.setLatLng([
        lat,
        lng,
      ])
    }

    // Al llegar se vacía la línea, aunque el muestreo conserve
    // coordenadas repetidas del destino.
    const remainingPositions: L.LatLngTuple[] =
      motion.status === 'completed'
        ? []
        : motion.remainingCoordinates.map(
            ([lng, lat]) => [lat, lng],
          )

    remainingRouteRef.current?.setLatLngs(
      remainingPositions,
    )

    if (
      alternative !== null
      || motion.traveledMeters > 0
      || motion.status === 'completed'
    ) {
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
    }
  }, [
    incidentMap,
    motion.position,
    motion.remainingCoordinates,
    motion.traveledMeters,
    motion.status,
    route,
    alternative,
  ])

  useEffect(() => {
    const layer = blockedLayerRef.current

    if (!layer) return

    // Reemplazamos solo los incidentes. La red peatonal y el recorrido
    // pertenecen a otras capas y permanecen en el mapa.
    layer.clearLayers()

    // El mapa incluye información y precauciones.
    // Solo los bloqueos generan restricciones sobre el recorrido.
    activeIncidents.forEach((incident) => {
      const appearance = getIncidentAppearance(
        incident.type,
      )

      incident.pedestrianImpact?.segments.forEach(
        (segment) => {
          L.polyline(
            segment.coordinates.map(
              ([lng, lat]): L.LatLngTuple => [
                lat,
                lng,
              ],
            ),
            {
              color:
                incident.effect === 'blockage'
                  ? '#dc2626'
                  : incident.effect === 'caution'
                    ? '#d97706'
                    : '#2563eb',
              weight: 9,
              opacity: 0.8,
              interactive: false,
            },
          ).addTo(layer)
        },
      )

      if (incident.surfaceImpact) {
        L.geoJSON(
          incident.surfaceImpact.geometry,
          {
            style: {
              color:
                incident.effect === 'blockage'
                  ? '#dc2626'
                  : incident.effect === 'caution'
                    ? '#d97706'
                    : '#2563eb',
              weight: 2,
              fillOpacity: 0.3,
            },
            interactive: false,
          },
        ).addTo(layer)
      }

      const area = incident.blockedArea

      const center: L.LatLngTuple = [
        (area.south + area.north) / 2,
        (area.west + area.east) / 2,
      ]

      const icon = L.icon({
        iconUrl: appearance.iconUrl,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        tooltipAnchor: [0, -24],
        className: 'simulation-blockage-icon',
      })

      const effectLabel =
        incident.effect === 'blockage'
          ? 'Paso bloqueado'
          : incident.effect === 'caution'
            ? 'Circular con precaución'
            : 'Información del recorrido'

      // Leaflet interpreta cadenas como HTML.
      // textContent muestra las descripciones como texto literal.
      const tooltip = document.createElement('div')

      const heading = document.createElement('strong')
      heading.textContent = appearance.label

      const effect = document.createElement('div')
      effect.textContent = effectLabel

      const description = document.createElement('div')
      description.textContent = incident.description

      const reporter = document.createElement('div')
      reporter.textContent =
        `Informó: ${incident.reporterName ?? 'Sin identificar'}`

      const expiration = document.createElement('div')
      expiration.textContent =
        `Vigente hasta: ${new Date(incident.expiresAt).toLocaleString('es-AR')}`

      tooltip.append(
        heading,
        effect,
        description,
        reporter,
        expiration,
      )

      L.marker(center, {
        icon,
        alt: appearance.label,
        title: appearance.label,
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(tooltip, {
          direction: 'top',
        })
        .addTo(layer)
    })
  }, [incidentMap, activeIncidents])

  const scrollToMap = useCallback(() => {
    containerRef.current?.scrollIntoView({
      block: 'center',
    })
  }, [])

  return {
    containerRef,
    map: incidentMap,
    scrollToMap,
  }
}