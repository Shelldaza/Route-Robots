import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPath,
  samplePath,
} from '../src/utils/simulation-path.ts'

test('ubica al robot a mitad de un segmento', () => {
  const path = buildPath([[0, 0], [0.01, 0]])
  const result = samplePath(path, 0.5)

  assert.ok(Math.abs(result.position[0] - 0.005) < 0.000001)
  assert.equal(result.position[1], 0)
  assert.deepEqual(
    result.remainingCoordinates.at(-1),
    [0.01, 0],
  )
})

test('recorre todos los segmentos y alcanza el destino', () => {
  const path = buildPath([
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
  ])

  assert.deepEqual(samplePath(path, 0).position, [0, 0])
  assert.deepEqual(samplePath(path, 1).position, [0.01, 0.01])
  assert.deepEqual(samplePath(path, 2).position, [0.01, 0.01])
})

test('admite coordenadas consecutivas repetidas', () => {
  const path = buildPath([
    [0, 0],
    [0, 0],
    [0.01, 0],
  ])

  const result = samplePath(path, 0.5)

  assert.ok(Math.abs(result.position[0] - 0.005) < 0.000001)
})

test('controla un recorrido sin longitud', () => {
  const path = buildPath([[0, 0], [0, 0]])

  assert.deepEqual(samplePath(path, 0.5).position, [0, 0])
})