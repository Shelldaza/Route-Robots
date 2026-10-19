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

describe('Incidentes asociados a tramos peatonales', () => {
  const south = [[-77.04, 38.907], [-77.039, 38.907]]
  const north = [[-77.04, 38.9072], [-77.039, 38.9072]]
  const incident = { ...blockage, pedestrianImpact: { segments: [{ coordinates: south }] } }

  it('ignora el rectángulo de compatibilidad y mantiene libre la vereda de enfrente', () => {
    assert.deepEqual(getRouteBlockages(north, [incident]), [])
    assert.deepEqual(getRouteBlockages(south, [incident]), [incident])
  })
  it('detecta la parte pendiente dentro del tramo y el sentido inverso', () => {
    assert.deepEqual(getRouteBlockages([[-77.0395, 38.907], south[1]], [incident]), [incident])
    assert.deepEqual(getRouteBlockages([...south].reverse(), [incident]), [incident])
  })
  it('tocar una esquina al tomar otro tramo no cuenta como atravesar el bloqueo', () => {
    assert.deepEqual(getRouteBlockages([south[0], north[0]], [incident]), [])
    assert.deepEqual(getRouteBlockages([south[1], [-77.038, 38.907]], [incident]), [])
  })
  it('un alcance ampliado afecta exactamente las geometrías seleccionadas', () => {
    const expanded = { ...incident, pedestrianImpact: { segments: [
      { coordinates: south }, { coordinates: north },
    ] } }
    assert.deepEqual(getRouteBlockages(north, [expanded]), [expanded])
    assert.deepEqual(getRouteBlockages(north, [{ ...expanded, effect: 'caution' }]), [])
  })
})
