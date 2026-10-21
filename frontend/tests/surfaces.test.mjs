import assert from 'node:assert/strict'
import { it } from 'node:test'

import {
  boxArea,
  contains,
  isArea,
  lineHits,
  local,
  world,
} from '../../shared/surfaces.ts'

const center = [-77.04, 38.9]

it('mantiene el centro al girar el rectángulo', () => {
  const area = boxArea({
    center,
    halfWidth: 0.5,
    halfLength: 1,
    angle: Math.PI / 2,
  })

  assert.equal(isArea(area), true)

  const first = local(
    area.coordinates[0][0][0],
    center,
  )

  assert.ok(
    Math.abs(first[0] - 1) < 0.001,
  )

  assert.ok(
    Math.abs(first[1] + 0.5) < 0.001,
  )

  assert.equal(
    contains(area, center),
    true,
  )
})

it('detecta colisiones con el recorrido pendiente', () => {
  const area = boxArea({
    center,
    halfWidth: 0.5,
    halfLength: 1,
    angle: 0,
  })

  assert.equal(
    lineHits([
      world([0, -3], center),
      world([0, 3], center),
    ], area),
    true,
  )

  assert.equal(
    lineHits([
      world([2, -3], center),
      world([2, 3], center),
    ], area),
    false,
  )
})