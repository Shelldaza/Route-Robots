import { errorMessage } from '../api/client.ts';
import { requestWalkSurfaces } from '../features/incidents/editor-api';
import type { IncidentEffect } from '../../../shared/contracts/incidents'
import * as L from 'leaflet'

import {
  boxArea,
  local,
  world,
} from '../../../shared/surfaces'

import type { Area, Box, Point } from '../../../shared/contracts/surfaces'

import type { PedestrianSegment } from '../../../shared/contracts/pedestrian'


export type IncidentSelection =
  | {
    mode: 'surface'
    box: Box
  }
  | {
    mode: 'segment'
    segments: PedestrianSegment[]
  }

export type MapPreview = {
  geometry: Area
  free: Area
  coordinates: Point[]
}

export type EditorState = {
  selection: IncidentSelection | null
  preview: MapPreview | null
  effect: IncidentEffect
  disabled: boolean
  canConfirm: boolean
  message: string
}

export const EDITOR_ICONS = {
  move:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18m6-6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/></svg>',

  resize:
    '<svg viewBox="0 0 24 24" fill="none" stroke-linejoin="round" aria-hidden="true"><path d="M5 19V5h14" stroke="white" stroke-width="6"/><path d="M5 19V5h14" stroke="currentColor" stroke-width="3"/></svg>',

  rotate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L21 9"/></svg>',
}

const ll = (point: Point): L.LatLngTuple => [
  point[1],
  point[0],
]

export function createIncidentMapEditor(
  map: L.Map,
  callbacks: {
    onPoint: (point: Point) => void
    onBox: (box: Box) => void
    onConfirm: () => void
    onCancel: () => void
  },
) {
  let state: EditorState = {
    selection: null,
    preview: null,
    effect: 'blockage',
    disabled: false,
    canConfirm: false,
    message:
      'Hacé clic sobre una vereda o una línea peatonal.',
  }

  let disposed = false
  let moving: number | null = null
  let request: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let markers: L.Marker[] = []

  const surfacePane = 'incident-editor-surfaces'
  const draftPane = 'incident-editor-draft'

  for (
    const [name, z]
    of [[surfacePane, '410'], [draftPane, '590']] as const
  ) {
    const pane = map.getPane(name) ?? map.createPane(name)

    pane.style.zIndex = z
    pane.style.pointerEvents = 'none'
  }

  const originalTiles: L.TileLayer[] = []

  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      originalTiles.push(layer)
    }
  })

  const photos = [2025, 2023].map((year) =>
    L.tileLayer(
      `https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Ortho${year}_WebMercator/MapServer/tile/{z}/{y}/{x}`,
      {
        maxNativeZoom: 23,
        maxZoom: 22,
        attribution: `Foto aérea ${year} · DC GIS / OCTO`,
      },
    ),
  )

  const baseLayers: Record<string, L.Layer> = {
    'Foto aérea DC 2025': photos[0]!,
    'Foto aérea DC 2023': photos[1]!,
  }

  if (originalTiles[0]) {
    baseLayers['Mapa OpenStreetMap'] = originalTiles[0]
  }

  const baseControl = L.control.layers(baseLayers).addTo(map)

  const surfaces = L.layerGroup().addTo(map)
  const draft = L.layerGroup().addTo(map)

  const link = L.polyline([], {
    pane: draftPane,
    color: '#64748b',
    weight: 1.5,
    dashArray: '3 3',
    interactive: false,
  }).addTo(map)

  const control = new L.Control({
    position: 'topleft',
  })

  const panel = L.DomUtil.create(
    'div',
    'incident-map-toolbar',
  )

  const heading = document.createElement('strong')
  heading.textContent = 'Ubicar incidente'

  const status = document.createElement('p')
  status.setAttribute('role', 'status')

  const actions = document.createElement('div')

  const confirm = document.createElement('button')
  confirm.type = 'button'
  confirm.textContent = 'Confirmar ubicación'

  confirm.onclick = () => {
    if (state.canConfirm && !state.disabled) {
      callbacks.onConfirm()
    }
  }

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.textContent = 'Cancelar'
  cancel.onclick = () => callbacks.onCancel()

  actions.append(confirm, cancel)
  panel.append(heading, status, actions)

  L.DomEvent.disableClickPropagation(panel)
  L.DomEvent.disableScrollPropagation(panel)

  control.onAdd = () => panel
  control.addTo(map)

  function draw() {
    draft.clearLayers()

    status.textContent = state.message
    confirm.disabled = !state.canConfirm || state.disabled
    cancel.disabled = false

    const color =
      state.effect === 'blockage'
        ? '#dc2626'
        : state.effect === 'caution'
          ? '#d97706'
          : '#2563eb'

    const selection = state.selection

    if (selection?.mode === 'segment') {
      for (const segment of selection.segments) {
        L.polyline(segment.coordinates.map(ll), {
          pane: draftPane,
          color,
          weight: 8,
          interactive: false,
        }).addTo(draft)
      }
    }

    if (state.preview) {
      L.geoJSON(state.preview.free, {
        pane: draftPane,
        style: {
          color: '#15803d',
          weight: 1,
          fillOpacity: 0.08,
        },
        interactive: false,
      }).addTo(draft)

      if (state.preview.coordinates.length > 1) {
        L.polyline(
          state.preview.coordinates.map(ll),
          {
            pane: draftPane,
            color: '#15803d',
            weight: 4,
            interactive: false,
          },
        ).addTo(draft)
      }
    }

    if (selection?.mode !== 'surface') {
      markers.forEach((marker) => marker.remove())
      markers = []
      link.setLatLngs([])
      return
    }

    const box = selection.box

    L.geoJSON(boxArea(box), {
      pane: draftPane,
      style: {
        color,
        weight: 2,
        dashArray: '5 4',
        fillOpacity: 0.1,
      },
      interactive: false,
    }).addTo(draft)

    if (state.preview) {
      L.geoJSON(state.preview.geometry, {
        pane: draftPane,
        style: {
          color,
          weight: 3,
          fillOpacity: 0.5,
        },
        interactive: false,
      }).addTo(draft)
    }

    const corners = boxArea(box)
      .coordinates[0]![0]!
      .slice(0, 4)

    const edge = world([
      -Math.sin(box.angle) * box.halfLength,
      Math.cos(box.angle) * box.halfLength,
    ], box.center)

    const at = map.layerPointToLatLng(
      map.latLngToLayerPoint(ll(edge)).add(
        L.point(
          -Math.sin(box.angle) * 40,
          -Math.cos(box.angle) * 40,
        ),
      ),
    )

    const rotation: Point = [at.lng, at.lat]

    const positions = [
      box.center,
      ...corners,
      rotation,
    ]

    link.setLatLngs([
      ll(edge),
      ll(rotation),
    ])

    if (!markers.length) {
      markers = positions.map((point, index) => {
        const kind =
          index === 0
            ? 'move'
            : index === 5
              ? 'rotate'
              : 'resize'

        const marker = L.marker(ll(point), {
          draggable: true,
          zIndexOffset: index === 0 ? 3002 : 3000,
          title:
            index === 0
              ? 'Mover incidente'
              : index === 5
                ? 'Girar incidente'
                : 'Cambiar tamaño',
          icon: L.divIcon({
            className: `surface-handle surface-handle--${kind}`,
            html:
              `<span class="surface-handle-visual">${EDITOR_ICONS[kind]}</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(map)

        marker.on('dragstart', () => {
          moving = index
        })

        marker.on('drag', () => {
          if (
            state.disabled
            || state.selection?.mode !== 'surface'
          ) {
            return
          }

          const previous = state.selection.box
          const position = marker.getLatLng()

          const point: Point = [
            position.lng,
            position.lat,
          ]

          let next = { ...previous }

          if (index === 0) {
            next.center = point
          } else {
            const [x, y] = local(
              point,
              previous.center,
            )

            if (index === 5) {
              next.angle =
                Math.atan2(y, x) - Math.PI / 2
            } else {
              const c = Math.cos(previous.angle)
              const s = Math.sin(previous.angle)

              next = {
                ...previous,
                halfWidth: Math.max(
                  0.1,
                  Math.min(20, Math.abs(x * c + y * s)),
                ),
                halfLength: Math.max(
                  0.1,
                  Math.min(20, Math.abs(-x * s + y * c)),
                ),
              }
            }
          }

          state = {
            ...state,
            selection: {
              mode: 'surface',
              box: next,
            },
            preview: null,
            canConfirm: false,
          }

          callbacks.onBox(next)
          draw()
        })

        marker.on('dragend', () => {
          moving = null
          draw()
        })

        return marker
      })
    }

    positions.forEach((point, index) => {
      const marker = markers[index]!

      if (moving !== index) {
        marker.setLatLng(ll(point))
      }

      const element = marker.getElement()

      if (index > 0 && index < 5) {
        const angle =
          [-90, 180, 90, 0][index - 1]!
          - box.angle * 180 / Math.PI

        element
          ?.querySelector<HTMLElement>(
            '.surface-handle-visual',
          )
          ?.style.setProperty(
            '--surface-handle-rotation',
            `${angle}deg`,
          )

        const [x, y] = local(point, box.center)

        const direction =
          (
            (
              Math.round(
                Math.atan2(-y, x) / (Math.PI / 4),
              ) % 4
            ) + 4
          ) % 4

        if (element) {
          element.style.cursor = [
            'ew-resize',
            'nwse-resize',
            'ns-resize',
            'nesw-resize',
          ][direction]!
        }
      }

      if (state.disabled) {
        marker.dragging?.disable()
      } else {
        marker.dragging?.enable()
      }

      element?.classList.toggle(
        'surface-handle--disabled',
        state.disabled,
      )
    })
  }

  async function load() {
    request?.abort()
    surfaces.clearLayers()

    if (map.getZoom() < 18) return

    const controller = new AbortController()
    request = controller

    const bounds = map.getBounds()

    const query = new URLSearchParams({
      south: String(bounds.getSouth()),
      west: String(bounds.getWest()),
      north: String(bounds.getNorth()),
      east: String(bounds.getEast()),
      source: 'current',
    })

    try {
      const result = await requestWalkSurfaces(query, controller.signal)

      if (disposed || controller.signal.aborted) {
        return
      }

      for (const surface of result) {
        L.geoJSON(surface.geometry, {
          pane: surfacePane,
          style: {
            color:
              surface.code === 1482
                ? '#b91c1c'
                : surface.code === 1481
                  ? '#b45309'
                  : '#0f766e',
            weight: 1.5,
            fillOpacity: 0.14,
            dashArray:
              [1481, 1482].includes(surface.code)
                ? '4 3'
                : '',
          },
          interactive: false,
        }).addTo(surfaces)
      }
    } catch (error) {
      if (
        !disposed
        && !controller.signal.aborted
      ) {
        status.textContent = errorMessage(error)
      }
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void load(), 250)
  }

  const container = map.getContainer()

  let down: [number, number] | null = null
  let dragged = false

  const pointerDown = (event: PointerEvent) => {
    down = [event.clientX, event.clientY]
    dragged = false
  }

  const pointerUp = (event: PointerEvent) => {
    if (down) {
      dragged = Math.hypot(
        event.clientX - down[0],
        event.clientY - down[1],
      ) > 5
    }
  }

  const click = (event: MouseEvent) => {
    const target = event.target instanceof Element
      ? event.target
      : null

    if (
      target?.closest(
        '.leaflet-control, .surface-handle, .leaflet-popup',
      )
    ) {
      return
    }

    if (
      dragged
      || moving !== null
      || event.detail === 0
    ) {
      return
    }

    event.stopPropagation()
    event.preventDefault()

    if (state.disabled) return

    if (map.getZoom() < 18) {
      status.textContent =
        'Acercá el mapa para elegir una ubicación.'
      return
    }

    const point = map.mouseEventToLatLng(event)

    callbacks.onPoint([
      point.lng,
      point.lat,
    ])
  }

  container.addEventListener(
    'pointerdown',
    pointerDown,
    true,
  )

  container.addEventListener(
    'pointerup',
    pointerUp,
    true,
  )

  container.addEventListener('click', click, true)

  const doubleClickEnabled =
    map.doubleClickZoom.enabled()

  map.doubleClickZoom.disable()

  map.on('moveend', schedule)
  map.on('zoomend', draw)

  void load()

  return {
    update(next: EditorState) {
      state = next

      if (!disposed) draw()
    },

    remove() {
      disposed = true

      clearTimeout(timer)
      request?.abort()

      container.removeEventListener(
        'pointerdown',
        pointerDown,
        true,
      )

      container.removeEventListener(
        'pointerup',
        pointerUp,
        true,
      )

      container.removeEventListener(
        'click',
        click,
        true,
      )

      map.off('moveend', schedule)
      map.off('zoomend', draw)

      if (doubleClickEnabled) {
        map.doubleClickZoom.enable()
      }

      markers.forEach((marker) => marker.remove())

      surfaces.remove()
      draft.remove()
      link.remove()
      control.remove()
      baseControl.remove()

      photos.forEach((layer) => layer.remove())

      if (
        map.getContainer().isConnected
        && map.getPane('tilePane')?.isConnected
      ) {
        originalTiles.forEach((layer) => {
          if (!map.hasLayer(layer)) {
            layer.addTo(map)
          }
        })
      }
    },
  }
}