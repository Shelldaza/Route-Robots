import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateRouteEstimates,
} from '../src/utils/route-estimates.ts'

const robot = {
  speedKmh: 4,
  batteryCapacityWh: 500,
  consumptionWhPerKm: 40,
}

test('calcula tiempo, consumo y porcentaje de capacidad', () => {
  assert.deepEqual(
    calculateRouteEstimates(3000, robot),
    {
      durationSeconds: 2700,
      consumptionWh: 120,
      requiredCapacityPercent: 24,
    },
  )
})

test('una distancia cero no requiere tiempo ni energía', () => {
  assert.deepEqual(
    calculateRouteEstimates(0, robot),
    {
      durationSeconds: 0,
      consumptionWh: 0,
      requiredCapacityPercent: 0,
    },
  )
})

test('conserva porcentajes mayores que 100', () => {
  const result = calculateRouteEstimates(15000, robot)

  assert.equal(result?.consumptionWh, 600)
  assert.equal(result?.requiredCapacityPercent, 120)
})

test('rechaza distancias inválidas', () => {
  for (const distance of [-1, NaN, Infinity]) {
    assert.equal(calculateRouteEstimates(distance, robot), null)
  }
})

test('rechaza perfiles con valores operativos inválidos', () => {
  for (const field of [
    'speedKmh',
    'batteryCapacityWh',
    'consumptionWhPerKm',
  ]) {
    for (const value of [0, -1, NaN, Infinity]) {
      assert.equal(
        calculateRouteEstimates(3000, {
          ...robot,
          [field]: value,
        }),
        null,
      )
    }
  }
})