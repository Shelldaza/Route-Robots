import type {
  Coordinate,
} from '../../../../shared/contracts/geography';

import {
  nextReportAt,
} from '../../utils/random-report-schedule.ts';

export function reportBody(
  previous: string | null,
  context: {
    simulationId: string;
    generationId: string;
    index: number;
    networkVersion: string;
    nextAt: number;
    coordinates: Coordinate[];
  },
) {
  // El reintento conserva exactamente el reporte original.
  if (previous !== null) return previous;

  const { nextAt, ...body } = context;

  return JSON.stringify({
    ...body,
    scenarioTime: new Date(nextAt).toISOString(),
  });
}

export function advanceReport(
  previousAt: number,
  schedule = nextReportAt,
) {
  // No usa Date.now() ni salta eventos al acelerar la simulación.
  return schedule(previousAt);
}
