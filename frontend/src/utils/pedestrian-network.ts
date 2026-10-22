import { fetchPedestrianNetwork } from '../features/pedestrian/network-api';
export { fetchPedestrianNetwork } from '../features/pedestrian/network-api';
import * as L from 'leaflet'

import type {
  PedestrianSegment,
  PedestrianNetwork,
} from '../../../shared/contracts/pedestrian'

export {
  isPedestrianImpact,
} from './pedestrian-validation'

export type {
  PedestrianSegment,
  PedestrianNetwork,
  PedestrianImpact,
} from '../../../shared/contracts/pedestrian'

export const segmentLabels = {
  sidewalk: 'Vereda',
  crossing: 'Cruce peatonal',
  path: 'Camino peatonal',
}

const MIN_PEDESTRIAN_ZOOM = 17

const visibleCache = new Map<
  string,
  PedestrianNetwork
>()

export function drawPedestrianNetwork(
  map: L.Map,
  network: PedestrianNetwork,
  selectedIds: readonly string[] = [],
  onSelect?: (segment: PedestrianSegment) => void,
  selectedSegments: readonly PedestrianSegment[] = [],
  onVisibleChange?: (
    segments: PedestrianSegment[],
  ) => void,
) {
  const layer = L.layerGroup().addTo(map)
  const renderer = L.canvas({ padding: 0.2 })
  const previewPaneName = 'pedestrian-incident-preview'

  const previewPane =
    map.getPane(previewPaneName)
    ?? map.createPane(previewPaneName)

  // La selección aparece por encima del recorrido.
  previewPane.style.zIndex = '450'
  previewPane.style.pointerEvents = 'none'

  const previewRenderer = L.canvas({
    pane: previewPaneName,
    padding: 0.2,
  })

  const selected = new Set(selectedIds)

  const pinned = selectedSegments.length
    ? selectedSegments
    : network.segments.filter(
      (segment) => selected.has(segment.id),
    )

  let disposed = false
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0

  const notice = L.DomUtil.create('div')

  Object.assign(notice.style, {
    background: 'white',
    padding: '6px 10px',
    borderRadius: '6px',
    maxWidth: '260px',
    fontSize: '12px',
    boxShadow: '0 1px 5px #0003',
  })

  notice.setAttribute('role', 'status')
  L.DomEvent.disableClickPropagation(notice)

  const control = new L.Control({
    position: 'bottomleft',
  })

  control.onAdd = () => notice
  control.addTo(map)

  function render(
    segments: readonly PedestrianSegment[],
  ) {
    layer.clearLayers()

    const unique = new Map(
      segments.map((segment) => [
        segment.id,
        segment,
      ]),
    )

    // Una selección permanece visible aunque salga del área consultada.
    for (const segment of pinned) {
      unique.set(segment.id, segment)
    }

    for (const segment of unique.values()) {
      const isSelected = selected.has(segment.id)

      const line = L.polyline(
        segment.coordinates.map(
          ([lng, lat]) => [lat, lng],
        ),
        {
          renderer,
          color: isSelected
            ? '#dc2626'
            : segment.kind === 'crossing'
              ? '#d97706'
              : '#6366f1',
          weight: isSelected ? 8 : 4,
          opacity: isSelected ? 1 : 0.65,
          interactive: !!onSelect,
          bubblingMouseEvents: false,
        },
      ).addTo(layer)

      if (isSelected) {
        L.polyline(
          segment.coordinates.map(
            ([lng, lat]): L.LatLngTuple => [lat, lng],
          ),
          {
            renderer: previewRenderer,
            color: '#dc2626',
            weight: 8,
            opacity: 1,
            interactive: false,
          },
        ).addTo(layer)
      }

      if (onSelect) {
        const tooltip = document.createElement('span')

        tooltip.textContent =
          `${segmentLabels[segment.kind]}`
          + (segment.name ? ` · ${segment.name}` : '')

        line.bindTooltip(tooltip)
        line.on('click', () => onSelect(segment))
      }
    }
  }

  async function load(currentSequence: number) {
    const bounds = map.getBounds().pad(0.15)

    const area = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    }

    const key =
      `${network.version}:`
      + Object.values(area)
        .map((number) => number.toFixed(5))
        .join(':')

    const request = new AbortController()
    controller = request

    notice.textContent = 'Cargando tramos de esta zona…'

    try {
      let visible = visibleCache.get(key)

      if (!visible) {
        visible = await fetchPedestrianNetwork(
          AbortSignal.any([
            request.signal,
            AbortSignal.timeout(20000),
          ]),
          area,
        )

        if (
          disposed
          || request.signal.aborted
          || currentSequence !== sequence
        ) {
          return
        }

        if (visible.version !== network.version) {
          throw new Error(
            'La red cambió. Iniciá una entrega nueva.',
          )
        }

        if (visibleCache.size >= 12) {
          const oldest =
            visibleCache.keys().next().value

          if (oldest !== undefined) {
            visibleCache.delete(oldest)
          }
        }

        visibleCache.set(key, visible)
      }

      if (
        disposed
        || request.signal.aborted
        || currentSequence !== sequence
      ) {
        return
      }

      render(visible.segments)
      onVisibleChange?.(visible.segments)

      notice.textContent = visible.segments.length
        ? `${visible.segments.length} tramos en esta zona`
        : 'No hay tramos peatonales mapeados en esta zona.'
    } catch (error) {
      if (
        disposed
        || request.signal.aborted
        || currentSequence !== sequence
      ) {
        return
      }

      render([])
      onVisibleChange?.([])

      notice.textContent =
        error instanceof Error
          ? error.message
          : 'No se pudo cargar esta zona. Mové el mapa para reintentar.'
    }
  }

  function refresh() {
    sequence += 1
    const currentSequence = sequence

    clearTimeout(timer)
    controller?.abort()

    if (map.getZoom() < MIN_PEDESTRIAN_ZOOM) {
      render([])
      onVisibleChange?.([])

      notice.textContent =
        `Acercá el mapa a zoom ${MIN_PEDESTRIAN_ZOOM} `
        + 'para ver las veredas y cruces.'

      return
    }

    timer = setTimeout(() => {
      void load(currentSequence)
    }, 180)
  }

  function dispose() {
    if (disposed) return

    disposed = true
    clearTimeout(timer)
    controller?.abort()

    map.off('moveend zoomend', refresh)
    map.off('unload', dispose)

    control.remove()
    renderer.remove()
    previewRenderer.remove()
  }

  map.on('moveend zoomend', refresh)
  map.on('unload', dispose)
  layer.on('remove', dispose)

  refresh()

  return layer
}