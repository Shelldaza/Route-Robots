import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isRobot,
  isRobotModel,
  requiredWidth,
} from '../src/utils/robot-models.ts'

const model = {
  id: 'modelo',
  name: 'Prueba',
  speedKmh: 4,
  batteryCapacityWh: 500,
  consumptionWhPerKm: 40,
  maxSlopePercent: null,
  widthMeters: 0.6,
  lengthMeters: 0.8,
  lateralMarginMeters: 0.15,
  dataSource: 'simulated',
  sourceNotes: null,
  createdAt: '2026-10-19',
}

describe('Perfiles de modelos y robots', () => {
  it('reconoce un modelo y rechaza dimensiones o fuentes inválidas', () => {
    assert.equal(isRobotModel(model), true)

    for (const changes of [
      { widthMeters: -1 },
      { lengthMeters: 0 },
      { lateralMarginMeters: -1 },
      { dataSource: 'desconocido' },
      { speedKmh: Infinity },
    ]) {
      assert.equal(
        isRobotModel({ ...model, ...changes }),
        false,
      )
    }
  })

  it('permite medidas desconocidas', () => {
    assert.equal(
      isRobotModel({
        ...model,
        widthMeters: null,
        lengthMeters: null,
        lateralMarginMeters: null,
      }),
      true,
    )
  })

  it('reconoce unidades con modelo y registros anteriores sin medidas', () => {
    assert.equal(
      isRobot({
        ...model,
        model: 'Prueba',
        modelId: 'modelo',
      }),
      true,
    )

    assert.equal(
      isRobot({
        ...model,
        model: null,
        modelId: null,
        dataSource: null,
        widthMeters: null,
        lengthMeters: null,
        lateralMarginMeters: null,
      }),
      true,
    )

    assert.equal(
      isRobot({
        ...model,
        model: 'Prueba',
        modelId: 3,
      }),
      false,
    )
  })

  it('cuenta el margen a ambos lados', () => {
    assert.ok(
      Math.abs(requiredWidth(model) - 0.9) < 1e-10,
    )

    assert.equal(
      requiredWidth({
        ...model,
        lateralMarginMeters: 0,
      }),
      0.6,
    )
  })

  it('no inventa el margen o ancho faltante', () => {
    assert.equal(
      requiredWidth({
        ...model,
        widthMeters: null,
      }),
      null,
    )

    assert.equal(
      requiredWidth({
        ...model,
        lateralMarginMeters: null,
      }),
      null,
    )
  })
})