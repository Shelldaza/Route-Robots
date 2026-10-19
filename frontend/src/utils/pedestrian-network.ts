import * as L from 'leaflet'

export type PedestrianSegment = {
  id: string
  wayId: number
  from: string
  to: string
  kind: 'sidewalk' | 'crossing' | 'path'
  name: string
  coordinates: [number, number][]
}
export type PedestrianNetwork = {
  version: string
  name: string
  attribution: string
  source: string
  retrievedAt: string
  bounds: { south: number; west: number; north: number; east: number }
  segments: PedestrianSegment[]
}
export type PedestrianImpact = {
  networkVersion: string
  scope: 'segment' | 'street_section'
  segmentIds: string[]
  segments: PedestrianSegment[]
}

export function isPedestrianImpact(value: unknown): value is PedestrianImpact {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.networkVersion === 'string' &&
    (item.scope === 'segment' || item.scope === 'street_section') &&
    Array.isArray(item.segmentIds) && item.segmentIds.length > 0 &&
    item.segmentIds.every((id) => typeof id === 'string') &&
    Array.isArray(item.segments) && item.segments.length === item.segmentIds.length &&
    item.segments.every(isPedestrianSegment) &&
    item.segments.every((segment) => (item.segmentIds as string[]).includes(segment.id))
}
function isPedestrianSegment(value: unknown): value is PedestrianSegment {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.wayId === 'number' &&
    typeof item.from === 'string' && typeof item.to === 'string' && typeof item.name === 'string' &&
    ['sidewalk', 'crossing', 'path'].includes(String(item.kind)) &&
    Array.isArray(item.coordinates) && item.coordinates.length >= 2 &&
    item.coordinates.every((p) => Array.isArray(p) && p.length === 2 &&
      typeof p[0] === 'number' && Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 &&
      typeof p[1] === 'number' && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)
}
export async function fetchPedestrianNetwork(
  signal: AbortSignal,
  bounds?: {
    south: number
    west: number
    north: number
    east: number
  },
): Promise<PedestrianNetwork> {
  const query = bounds
    ? `?${new URLSearchParams({
      south: String(bounds.south),
      west: String(bounds.west),
      north: String(bounds.north),
      east: String(bounds.east),
    })}`
    : ''

  const response = await fetch(
    `/api/pedestrian-network${query}`,
    { signal },
  )

  const value: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    const message =
      value &&
        typeof value === 'object' &&
        'message' in value &&
        typeof value.message === 'string'
        ? value.message
        : 'No se pudo cargar la red peatonal.'

    throw new Error(message)
  }

  if (!value || typeof value !== 'object') {
    throw new Error('La red peatonal no es válida.')
  }

  const item = value as Record<string, unknown>

  const area = item.bounds as
    | Record<string, unknown>
    | undefined

  if (
    typeof item.version !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.attribution !== 'string' ||
    !Array.isArray(item.segments) ||
    !item.segments.every(isPedestrianSegment) ||
    !area ||
    !['south', 'west', 'north', 'east'].every(
      (key) =>
        typeof area[key] === 'number' &&
        Number.isFinite(area[key]),
    ) ||
    !(
      Number(area.south) < Number(area.north) &&
      Number(area.west) < Number(area.east)
    )
  ) {
    throw new Error(
      'La red peatonal recibida no es válida.',
    )
  }

  return value as PedestrianNetwork
}
export const segmentLabels = { sidewalk: 'Vereda', crossing: 'Cruce peatonal', path: 'Camino peatonal' }

const MIN_PEDESTRIAN_ZOOM = 17

const visibleCache = new Map<string, PedestrianNetwork>()

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
    map.getPane(previewPaneName) ??
    map.createPane(previewPaneName)

  // Por encima del recorrido y debajo de los marcadores.
  previewPane.style.zIndex = '450'

  // Los clics siguen llegando a las veredas.
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
      segments.map((segment) => [segment.id, segment]),
    )

    // La selección se conserva aunque salga de la zona cargada.
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

      // Refuerzo visual de la selección por encima del recorrido.
      // La línea original conserva la interacción para quitarla.
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
          `${segmentLabels[segment.kind]}` +
          (segment.name ? ` · ${segment.name}` : '')

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
      `${network.version}:` +
      Object.values(area)
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
          disposed ||
          request.signal.aborted ||
          currentSequence !== sequence
        ) {
          return
        }

        if (visible.version !== network.version) {
          throw new Error(
            'La red cambió. Iniciá una entrega nueva.',
          )
        }

        // Conserva únicamente las últimas zonas consultadas.
        if (visibleCache.size >= 12) {
          const oldest = visibleCache.keys().next().value

          if (oldest !== undefined) {
            visibleCache.delete(oldest)
          }
        }

        visibleCache.set(key, visible)
      }

      if (
        disposed ||
        request.signal.aborted ||
        currentSequence !== sequence
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
        disposed ||
        request.signal.aborted ||
        currentSequence !== sequence
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
        `Acercá el mapa a zoom ${MIN_PEDESTRIAN_ZOOM} ` +
        'para ver las veredas y cruces.'

      return
    }

    // Evita consultar repetidamente durante un mismo movimiento.
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