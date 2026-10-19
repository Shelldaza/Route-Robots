import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  nextReportAt,
} from '../src/utils/random-report-schedule.ts'

describe('Programación de reportes', () => {
  it('mantiene intervalos entre 120 y 180 segundos', () => {
    for (let index = 0; index <= 1000; index++) {
      const delay =
        nextReportAt(1000, index / 1000) - 1000

      assert.ok(
        delay >= 120_000 && delay <= 180_000,
      )
    }
  })

  it('utiliza la fecha del escenario', () => {
    const now =
      Date.parse('2030-01-01T12:00:00Z')

    assert.equal(
      nextReportAt(now, 0),
      now + 120_000,
    )

    assert.equal(
      nextReportAt(now, 1),
      now + 180_000,
    )
  })

  it('programa cada reporte después del anterior', () => {
    const first = nextReportAt(0, 0.3)

    assert.ok(
      nextReportAt(first, 0.7) > first,
    )

    assert.equal(
      nextReportAt(0, 0.3),
      first,
    )
  })
})