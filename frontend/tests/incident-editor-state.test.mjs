import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  editorReducer as reduce,
  initialEditorState as initial,
} from '../src/features/incidents/editor-state.ts'

const selection = {
  mode: 'surface',
  box: {
    center: [-77.04, 38.9],
    halfWidth: 1,
    halfLength: 1,
    angle: 0,
  },
}

const confirmed = () => [
  { type: 'begin' },
  { type: 'locate' },
  { type: 'select', selection },
  { type: 'confirm' },
].reduce(reduce, initial)

it('requiere una selección confirmada antes de guardar', () => {
  assert.equal(
    reduce(initial, { type: 'save' }),
    initial,
  )

  const editing = reduce(initial, { type: 'begin' })

  assert.equal(
    reduce(editing, { type: 'confirm' }).phase,
    'editing',
  )

  const selected = reduce(editing, {
    type: 'select',
    selection,
  })

  assert.equal(
    reduce(selected, { type: 'save' }).phase,
    'editing',
  )

  assert.equal(
    reduce(confirmed(), { type: 'save' }).phase,
    'saving',
  )
})

it('un cambio de ubicación invalida la confirmación', () => {
  const editing = reduce(
    confirmed(),
    { type: 'begin' },
  )

  const next = reduce(editing, {
    type: 'select',
    selection: {
      ...selection,
      box: {
        ...selection.box,
        halfWidth: 2,
      },
    },
  })

  assert.equal(next.phase, 'editing')

  assert.equal(
    reduce(next, { type: 'save' }).phase,
    'editing',
  )
})

it('cancelar restaura la ubicación confirmada y su alcance', () => {
  let state = confirmed()

  state = reduce(state, { type: 'begin' })

  state = reduce(state, {
    type: 'scope',
    scope: 'street_section',
  })

  state = reduce(state, {
    type: 'select',
    selection: {
      ...selection,
      box: {
        ...selection.box,
        halfWidth: 2,
      },
    },
  })

  state = reduce(state, { type: 'cancel' })

  assert.equal(state.phase, 'confirmed')
  assert.equal(state.scope, 'segment')
  assert.deepEqual(state.selection, selection)
})

it('cambiar el alcance de una selección confirmada exige confirmarla nuevamente', () => {
  const state = reduce(confirmed(), {
    type: 'scope',
    scope: 'street_section',
  })

  assert.equal(state.phase, 'modified')

  assert.equal(
    reduce(state, { type: 'save' }).phase,
    'modified',
  )
})

it('durante el guardado no admite otra edición y permite reintentar tras un error', () => {
  const saving = reduce(
    confirmed(),
    { type: 'save' },
  )

  assert.equal(
    reduce(saving, { type: 'begin' }),
    saving,
  )

  assert.equal(
    reduce(saving, { type: 'discard' }),
    saving,
  )

  const failed = reduce(
    saving,
    { type: 'saveFailed' },
  )

  assert.equal(failed.phase, 'confirmed')
  assert.deepEqual(failed.selection, selection)

  assert.equal(
    reduce(failed, { type: 'save' }).phase,
    'saving',
  )
})

it('al guardar correctamente limpia la selección', () => {
  const saved = reduce(
    reduce(confirmed(), { type: 'save' }),
    { type: 'saved' },
  )

  assert.equal(saved.phase, 'idle')
  assert.equal(saved.selection, null)
})

it('una respuesta de ubicación que llega después de cancelar no repone el borrador', () => {
  const canceled = reduce(
    reduce(initial, { type: 'begin' }),
    { type: 'cancel' },
  )

  assert.equal(
    reduce(canceled, {
      type: 'select',
      selection,
    }),
    canceled,
  )
})

it('reintentar el mismo reporte conserva identificador, fecha y cuerpo', async () => {
  const {
    prepareSubmission,
  } = await import(
    '../src/features/incidents/editor-submission.ts'
  )

  const draft = {
    contextKey: 'sim:robot:v1',
    simulationId: 'sim',
    networkVersion: 'v1',
    coordinates: [],
    selection,
    type: 'pothole',
    effect: 'blockage',
    description: 'Bache',
    durationMinutes: 15,
    multiple: false,
    scope: 'segment',
  }

  let calls = 0

  const createId = () => `id-${++calls}`

  const first = prepareSubmission(
    null,
    draft,
    () => '2026-10-21T12:00:00Z',
    createId,
  )

  const retry = prepareSubmission(
    first,
    {
      ...draft,
      durationMinutes: Number('15.0'),
    },
    () => '2026-10-21T12:01:00Z',
    createId,
  )

  assert.equal(retry, first)
  assert.equal(calls, 1)

  assert.notEqual(
    prepareSubmission(
      first,
      {
        ...draft,
        contextKey: 'other:robot:v1',
      },
      () => '2026-10-21T12:01:00Z',
      createId,
    ),
    first,
  )
})