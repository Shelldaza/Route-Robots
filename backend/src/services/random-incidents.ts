import {
  createIncident,
  findIncidentById,
  listIncidents,
} from './incidents';

import {
  pedestrianNetwork,
  queryCompactSegments,
} from './pedestrian-network';

import {
  randomIncidentSchema,
  RandomIncidentError,
} from './random-incidents/schema';

import {
  isRouteReport,
  randomIncidentId,
} from './random-incidents/determinism';

import {
  chooseRandomIncident,
  reportBounds,
} from './random-incidents/selection';

export {
  randomIncidentSchema,
  RandomIncidentError,
} from './random-incidents/schema';

export {
  isRouteReport,
  randomIncidentId,
} from './random-incidents/determinism';

export {
  createRouteMatcher,
  segmentMidpoint,
} from './random-incidents/spatial';

export async function generateRandomIncident(
    value: unknown,
) {
    const input = randomIncidentSchema.parse(value);

    if (
        input.networkVersion
        !== pedestrianNetwork.version
    ) {
        throw new RandomIncidentError(
            409,
            'La red peatonal cambió. Iniciá un escenario nuevo.',
        );
    }

    const id = randomIncidentId(
        input.simulationId,
        input.generationId,
        input.index,
    );

    const seed =
        `${input.simulationId}:${input.generationId}`;

    const onRoute = isRouteReport(seed, input.index);

    // Recupera el evento si una respuesta anterior se perdió.
    const existing = await findIncidentById(id);

    if (existing) {
        return {
            status: 'created' as const,
            incident: existing,
            onRoute,
        };
    }



  const nearby = queryCompactSegments(
    reportBounds(input),
  );

  const incidents = await listIncidents(
    input.simulationId,
    { scenarioTime: input.scenarioTime },
  );

  const occupied = new Set(
    incidents.flatMap(
      (item) => item.pedestrianImpact?.segmentIds ?? [],
    ),
  );

  const choice = chooseRandomIncident(
    input,
    nearby,
    occupied,
  );

  if (!choice) {
    return {
      status: 'skipped' as const,
      message:
        'No hay un tramo libre adecuado para este reporte. Se reintentará en el próximo intervalo.',
    };
  }

  const incident = await createIncident(
    choice.report,
    id,
  );

  return {
    status: 'created' as const,
    incident,
    onRoute,
  };
}
