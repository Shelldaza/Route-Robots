import { z } from 'zod';

import {
  scenarioTimeSchema,
  simulationIdSchema,
} from '../incidents';

import {
  distanceMeters,
} from '../pedestrian-network';

export class RandomIncidentError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
    }
}

export const randomIncidentSchema = z.object({
    simulationId: simulationIdSchema,
    generationId: z.string().uuid(),
    index: z.number().int().min(0).max(99999),
    scenarioTime: scenarioTimeSchema,
    networkVersion: z.string().min(1),
    coordinates: z.array(
        z.tuple([
            z.number().finite().min(-180).max(180),
            z.number().finite().min(-90).max(90),
        ]),
    ).min(2).max(20000).refine(
        (points) => points.every(
            (point, index) =>
                index === 0
                || distanceMeters(
                    points[index - 1]!,
                    point,
                ) <= 50,
        ),
        'El recorrido debe conservar sus puntos peatonales intermedios.',
    ),
});
