import {
  useEffect,
  useRef,
} from 'react'

import type * as L from 'leaflet'

import {
  createIncidentMapEditor,
} from '../components/incident-map-editor'

import type {
  EditorState,
} from '../components/incident-map-editor'

import type {
  Box,
  Point,
} from '../../../shared/contracts/surfaces'

type Options = {
  map: L.Map | null
  editing: boolean
  state: EditorState
  onPoint: (point: Point) => void
  onBox: (box: Box) => void
  onConfirm: () => void
  onCancel: () => void
}

// El adaptador de Leaflet vive durante una edición.
// Cambiar el formulario actualiza sus datos sin recrear el mapa.
export function useIncidentMapEditing(
  options: Options,
) {
  const latest = useRef(options)

  const editor = useRef<
    ReturnType<typeof createIncidentMapEditor> | null
  >(null)

  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    if (!options.editing || !options.map) return

    const controller = createIncidentMapEditor(
      options.map,
      {
        onPoint: (point) =>
          latest.current.onPoint(point),

        onBox: (box) =>
          latest.current.onBox(box),

        onConfirm: () =>
          latest.current.onConfirm(),

        onCancel: () =>
          latest.current.onCancel(),
      },
    )

    editor.current = controller

    return () => {
      controller.remove()
      editor.current = null
    }
  }, [options.editing, options.map])

  useEffect(() => {
    editor.current?.update(options.state)
  }, [options.state, options.editing])
}