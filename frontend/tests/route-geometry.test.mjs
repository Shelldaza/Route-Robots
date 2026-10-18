import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getRouteBlockages,
  routeIntersectsBlockedAreas,
} from '../src/utils/route-geometry.ts'

const area = { south: 1, west: 1, north: 2, east: 2 }
const blockage = { id: 'blockage', effect: 'blockage', blockedArea: area }

// Coordenadas sintéticas para aislar la geometría de las APIs de mapas.
describe('Cruces de segmentos y áreas bloqueadas', () => {
  it('detecta un cruce aunque ambos extremos estén fuera', () => {
    assert.equal(routeIntersectsBlockedAreas([[0, 1.5], [3, 1.5]], [area]), true)
  })

  it('detecta cruces verticales y segmentos en sentido inverso', () => {
    for (const route of [
      [[1.5, 0], [1.5, 3]],
      [[3, 1.5], [0, 1.5]],
      [[1.5, 3], [1.5, 0]],
    ]) {
      assert.equal(routeIntersectsBlockedAreas(route, [area]), true)
    }
  })

  it('rechaza una ruta paralela fuera del rectángulo', () => {
    assert.equal(routeIntersectsBlockedAreas([[0, 0], [3, 0]], [area]), false)
  })

  it('rechaza una diagonal cercana que no llega a tocarlo', () => {
    assert.equal(routeIntersectsBlockedAreas([[0, 1.9], [1.9, 0]], [area]), false)
  })

  it('incluye el contacto con un borde o una esquina', () => {
    assert.equal(routeIntersectsBlockedAreas([[0, 1], [3, 1]], [area]), true)
    assert.equal(routeIntersectsBlockedAreas([[0, 2], [2, 0]], [area]), true)
  })

  it('detecta el origen dentro del área y segmentos interiores', () => {
    assert.equal(routeIntersectsBlockedAreas([[1.5, 1.5], [3, 3]], [area]), true)
    assert.equal(routeIntersectsBlockedAreas([[1.2, 1.2], [1.8, 1.8]], [area]), true)
  })

  it('revisa todos los segmentos y todas las áreas', () => {
    const farArea = { south: 8, west: 8, north: 9, east: 9 }
    assert.equal(
      routeIntersectsBlockedAreas([[0, 0], [0, 1.5], [3, 1.5]], [farArea, area]),
      true,
    )
  })

  it('no detecta cruces si no hay tramos pendientes o áreas', () => {
    assert.equal(routeIntersectsBlockedAreas([], [area]), false)
    assert.equal(routeIntersectsBlockedAreas([[1.5, 1.5]], [area]), false)
    assert.equal(routeIntersectsBlockedAreas([[0, 0], [3, 3]], []), false)
  })
})

describe('Bloqueos que afectan al recorrido pendiente', () => {
  it('excluye precauciones e información aunque crucen el recorrido', () => {
    const caution = { ...blockage, id: 'pothole', effect: 'caution' }
    const info = { ...blockage, id: 'info', effect: 'informational' }
    assert.deepEqual(
      getRouteBlockages([[0, 1.5], [3, 1.5]], [caution, blockage, info]),
      [blockage],
    )
  })

  it('excluye bloqueos lejanos y conserva el incidente original', () => {
    const far = {
      ...blockage,
      id: 'far',
      blockedArea: { south: 8, west: 8, north: 9, east: 9 },
    }
    const result = getRouteBlockages([[0, 1.5], [3, 1.5]], [far, blockage])
    assert.deepEqual(result, [blockage])
    assert.equal(result[0], blockage)
  })

  it('deja de incluir un bloqueo cuando el robot ya lo pasó', () => {
    assert.deepEqual(getRouteBlockages([[0, 1.5], [3, 1.5]], [blockage]), [blockage])
    assert.deepEqual(getRouteBlockages([[2.5, 1.5], [3, 1.5]], [blockage]), [])
  })

  it('deja de incluirlo al cargar un desvío que lo evita', () => {
    const detour = [[0, 1.5], [0, 3], [3, 3], [3, 1.5]]
    assert.deepEqual(getRouteBlockages(detour, [blockage]), [])
  })

  it('no devuelve bloqueos después de completar el recorrido', () => {
    assert.deepEqual(getRouteBlockages([], [blockage]), [])
  })
})
