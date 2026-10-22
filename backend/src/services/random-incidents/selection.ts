import type { z } from 'zod';

import {
  INCIDENT_CATALOG,
} from '../../config/incident-catalog';

import type {
  IncidentType,
} from '../../config/incident-catalog';

import type {
  PedestrianSegment,
} from '../../../../shared/contracts/pedestrian';

import {
  distanceMeters,
} from '../pedestrian-network';

import {
  randomIncidentSchema,
} from './schema';

import {
  random,
  isRouteReport,
} from './determinism';

import {
  createRouteMatcher,
  segmentMidpoint,
} from './spatial';

type Input = z.infer<typeof randomIncidentSchema>;

const RADIUS = 1200;

export function reportBounds(input: Input) {
    const center = input.coordinates[0]!;


    const latGap = RADIUS / 110000;
    const lngGap = latGap / Math.max(
        0.001,
        Math.cos(center[1] * Math.PI / 180),
    );



  return {
    south: center[1] - latGap,
    north: center[1] + latGap,
    west: center[0] - lngGap,
    east: center[0] + lngGap,
  };
}

// Recibe candidatos y ocupación ya consultados.
// Elegir un reporte no escribe en la base de datos.
export function chooseRandomIncident(
  input: Input,
  nearby: PedestrianSegment[],
  occupied: Set<string>,
) {
  const center = input.coordinates[0]!;
  const destination = input.coordinates.at(-1)!;
  const seed = input.simulationId + ':' + input.generationId;
  const onRoute = isRouteReport(seed, input.index);

    const matches =
        createRouteMatcher(input.coordinates);

    const candidates = nearby.filter((segment) => {
        if (occupied.has(segment.id)) return false;

        const middle = segmentMidpoint(segment);
        const gap = distanceMeters(center, middle);

        return (
            gap >= 30
            && gap <= RADIUS
            && distanceMeters(destination, middle) >= 15
            && matches(segment) === onRoute
        );
    });

    if (!candidates.length) return null;

    const draw = random(
        `${seed}:report:${input.index}`,
    );

    const segment = candidates[
        Math.floor(draw() * candidates.length)
    ]!;

    const types: IncidentType[] = [
        'pothole',
        'pothole',
        'crowd',
        'temporary_obstacle',
        'standing_water',
        'uneven_surface',
        'roadworks',
        'obstructing_vehicle',
    ];

    const type = types[
        Math.floor(draw() * types.length)
    ]!;

    const reporterName =
        `RR-SIM-${String(
            2 + Math.floor(draw() * 29),
        ).padStart(2, '0')}`;



  return {
    onRoute,
    report: {
            simulationId: input.simulationId,
            source: 'simulation',
            type,
            reporterName,
            description:
                INCIDENT_CATALOG[type].defaultDescription,
            startsAt: input.scenarioTime,
            pedestrianSelection: {
                networkVersion: input.networkVersion,
                scope: 'segment',
                segmentIds: [segment.id],
            },
        },
  };
}
