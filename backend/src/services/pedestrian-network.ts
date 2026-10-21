import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import {
    compileNetwork,
    decodeCompactNetwork,
    distanceMeters,
    routeOnCompactNetwork,
    segmentAt,
    segmentIndex,
    segmentIndicesInBounds,
} from './pedestrian-compact';

import type { Bounds } from '../../../shared/contracts/geography'
import type { CompactNetwork, PedestrianRouteInput } from './pedestrian-compact'

export {
    distanceMeters,
} from './pedestrian-compact';

import type { PedestrianSegment, PedestrianNetwork, PedestrianImpact } from '../../../shared/contracts/pedestrian';
export type { PedestrianSegment, PedestrianNetwork, PedestrianImpact } from '../../../shared/contracts/pedestrian';

const compact = decodeCompactNetwork(
    readFileSync(
        join(
            __dirname,
            '../data/dc-pedestrian-network.bin',
        ),
    ),
);

if (compact.format !== 1) {
    throw new Error(
        'Formato de red incompatible. Regenerá la captura compacta.',
    );
}

const lazySegments = new Proxy(
    new Array<PedestrianSegment>(compact.ways.length),
    {
        get(target, key, receiver) {
            if (
                typeof key === 'string'
                && /^(0|[1-9]\d*)$/.test(key)
            ) {
                const index = Number(key);

                return index < target.length
                    ? segmentAt(compact, index)
                    : undefined;
            }

            return Reflect.get(target, key, receiver);
        },

        has(target, key) {
            if (
                typeof key === 'string'
                && /^(0|[1-9]\d*)$/.test(key)
            ) {
                return Number(key) < target.length;
            }

            return Reflect.has(target, key);
        },

        set() {
            throw new Error(
                'La captura peatonal es de solo lectura.',
            );
        },

        deleteProperty() {
            throw new Error(
                'La captura peatonal es de solo lectura.',
            );
        },
    },
);

export const pedestrianNetwork: PedestrianNetwork = {
    ...compact.metadata,
    segments: lazySegments,
};

export function queryCompactSegments(
    bounds: Bounds,
    limit = Infinity,
): PedestrianSegment[] {
    return segmentIndicesInBounds(
        compact,
        bounds,
        limit,
    ).map((index) => segmentAt(compact, index));
}

export const pedestrianSelectionSchema = z.object({
    networkVersion: z.string().min(1),
    scope: z.enum(['segment', 'street_section']),
    segmentIds: z.array(z.string().min(1)).min(1).max(30),
}).strict().superRefine((value, context) => {
    if (
        new Set(value.segmentIds).size
            !== value.segmentIds.length
        || (
            value.scope === 'segment'
            && value.segmentIds.length !== 1
        )
        || (
            value.scope === 'street_section'
            && value.segmentIds.length < 2
        )
    ) {
        context.addIssue({
            code: 'custom',
            message:
                'Seleccioná un tramo o varios para ampliar el alcance.',
        });
    }
});

export function resolvePedestrianSelection(
    value: unknown,
): PedestrianImpact {
    const input = pedestrianSelectionSchema.parse(value);

    if (
        input.networkVersion
        !== pedestrianNetwork.version
    ) {
        throw new Error(
            'La red peatonal cambió. Recargá el escenario.',
        );
    }

    const segments = input.segmentIds.map((id) => {
        const index = segmentIndex(compact, id);

        if (index < 0) {
            throw new Error(
                'El tramo seleccionado no pertenece al sandbox.',
            );
        }

        return segmentAt(compact, index);
    });

    const points = segments.flatMap(
        (segment) => segment.coordinates,
    );

    const first = points[0]!;

    if (
        points.some(
            (point) => distanceMeters(first, point) > 350,
        )
    ) {
        throw new Error(
            'El alcance debe limitarse a una sección cercana (350 m).',
        );
    }

    return { ...input, segments };
}

export function impactBounds(
    impact: PedestrianImpact,
) {
    const points = impact.segments.flatMap(
        (segment) => segment.coordinates,
    );

    return {
        south:
            Math.min(...points.map((point) => point[1]))
            - 0.000001,
        west:
            Math.min(...points.map((point) => point[0]))
            - 0.000001,
        north:
            Math.max(...points.map((point) => point[1]))
            + 0.000001,
        east:
            Math.max(...points.map((point) => point[0]))
            + 0.000001,
    };
}

const fixtures =
    new WeakMap<PedestrianNetwork, CompactNetwork>();

export function routeOnPedestrianNetwork(
    input: PedestrianRouteInput,
    network: PedestrianNetwork = pedestrianNetwork,
) {
    let graph = compact;

    if (network !== pedestrianNetwork) {
        const cached = fixtures.get(network);

        graph = cached ?? compileNetwork(network);

        if (!cached) {
            fixtures.set(network, graph);
        }
    }

    return routeOnCompactNetwork(input, graph);
}