import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
    INCIDENT_CATALOG,
} from '../config/incident-catalog';
import type {
    IncidentType,
} from '../config/incident-catalog';

import {
    createIncident,
    findIncidentById,
    listIncidents,
    scenarioTimeSchema,
    simulationIdSchema,
} from './incidents';

import {
    distanceMeters,
    pedestrianNetwork,
    queryCompactSegments,
} from './pedestrian-network';
import type { PedestrianSegment } from '../../../shared/contracts/pedestrian'

type Point = [number, number];

const RADIUS = 1200;
const CELL = 0.0002;

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

function random(seed: string) {
    let state = createHash('sha256')
        .update(seed)
        .digest()
        .readUInt32LE(0);

    return () => {
        state += 0x6D2B79F5;

        let value = Math.imul(
            state ^ (state >>> 15),
            1 | state,
        );

        value ^= value + Math.imul(
            value ^ (value >>> 7),
            61 | value,
        );

        return (
            (value ^ (value >>> 14)) >>> 0
        ) / 4294967296;
    };
}

// Exactamente 15 posiciones por bloque de 100.
// El orden se mezcla de forma reproducible.
export function isRouteReport(
    seed: string,
    index: number,
): boolean {
    const draw = random(
        `${seed}:batch:${Math.floor(index / 100)}`,
    );

    const slots = Array.from(
        { length: 100 },
        (_, i) => i < 15,
    );

    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(draw() * (i + 1));

        [slots[i], slots[j]] = [
            slots[j]!,
            slots[i]!,
        ];
    }

    return slots[index % 100]!;
}

export function randomIncidentId(
    simulationId: string,
    generationId: string,
    index: number,
) {
    const hash = createHash('sha256')
        .update(
            `fleet:${simulationId}:${generationId}:${index}`,
        )
        .digest('hex');

    return (
        `${hash.slice(0, 8)}-`
        + `${hash.slice(8, 12)}-`
        + `4${hash.slice(13, 16)}-`
        + `a${hash.slice(17, 20)}-`
        + hash.slice(20, 32)
    );
}

// Cuenta la superposición longitudinal.
// Tocar una esquina no significa ocupar el recorrido.
function overlap(
    start: Point,
    end: Point,
    a: Point,
    b: Point,
): boolean {
    const scaleX =
        111320 * Math.cos(start[1] * Math.PI / 180);

    const dx = (end[0] - start[0]) * scaleX;
    const dy = (end[1] - start[1]) * 111320;
    const length = Math.hypot(dx, dy);

    if (length < 0.001) return false;

    const ax = (a[0] - start[0]) * scaleX;
    const ay = (a[1] - start[1]) * 111320;
    const bx = (b[0] - start[0]) * scaleX;
    const by = (b[1] - start[1]) * 111320;

    if (
        Math.abs(ax * dy - ay * dx) / length > 0.15
        || Math.abs(bx * dy - by * dx) / length > 0.15
    ) {
        return false;
    }

    const ta = (ax * dx + ay * dy) / length;
    const tb = (bx * dx + by * dy) / length;

    return (
        Math.min(length, Math.max(ta, tb))
        - Math.max(0, Math.min(ta, tb))
    ) > 0.02;
}

function cells(a: Point, b: Point) {
    const keys: string[] = [];
    const pad = 0.000002;

    for (
        let x = Math.floor(
            (Math.min(a[0], b[0]) - pad) / CELL,
        );
        x <= Math.floor(
            (Math.max(a[0], b[0]) + pad) / CELL,
        );
        x++
    ) {
        for (
            let y = Math.floor(
                (Math.min(a[1], b[1]) - pad) / CELL,
            );
            y <= Math.floor(
                (Math.max(a[1], b[1]) + pad) / CELL,
            );
            y++
        ) {
            keys.push(`${x}:${y}`);
        }
    }

    return keys;
}

// Evita comparar cada tramo cercano con toda la ruta.
export function createRouteMatcher(
    coordinates: Point[],
) {
    const index = new Map<
        string,
        { a: Point; b: Point }[]
    >();

    for (let i = 1; i < coordinates.length; i++) {
        const edge = {
            a: coordinates[i - 1]!,
            b: coordinates[i]!,
        };

        for (const key of cells(edge.a, edge.b)) {
            if (!index.has(key)) {
                index.set(key, []);
            }

            index.get(key)!.push(edge);
        }
    }

    return (segment: PedestrianSegment) => {
        for (
            let i = 1;
            i < segment.coordinates.length;
            i++
        ) {
            const a = segment.coordinates[i - 1]!;
            const b = segment.coordinates[i]!;

            for (const key of cells(a, b)) {
                for (const edge of index.get(key) ?? []) {
                    if (overlap(edge.a, edge.b, a, b)) {
                        return true;
                    }
                }
            }
        }

        return false;
    };
}

export function segmentMidpoint(
    segment: PedestrianSegment,
): Point {
    const points = segment.coordinates;

    const lengths = points.slice(1).map(
        (point, index) =>
            distanceMeters(points[index]!, point),
    );

    let remaining = lengths.reduce(
        (sum, value) => sum + value,
        0,
    ) / 2;

    for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i]!;

        if (remaining <= length && length > 0) {
            const a = points[i]!;
            const b = points[i + 1]!;
            const t = remaining / length;

            return [
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
            ];
        }

        remaining -= length;
    }

    return [...points[0]!];
}

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

    const center = input.coordinates[0]!;
    const destination = input.coordinates.at(-1)!;

    const latGap = RADIUS / 110000;
    const lngGap = latGap / Math.max(
        0.001,
        Math.cos(center[1] * Math.PI / 180),
    );

    const nearby = queryCompactSegments({
        south: center[1] - latGap,
        north: center[1] + latGap,
        west: center[0] - lngGap,
        east: center[0] + lngGap,
    });

    const incidents = await listIncidents(
        input.simulationId,
        { scenarioTime: input.scenarioTime },
    );

    const occupied = new Set(
        incidents.flatMap(
            (incident) =>
                incident.pedestrianImpact?.segmentIds
                ?? [],
        ),
    );

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

    if (!candidates.length) {
        return {
            status: 'skipped' as const,
            message:
                'No hay un tramo libre adecuado para este reporte. Se reintentará en el próximo intervalo.',
        };
    }

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

    const incident = await createIncident(
        {
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
        id,
    );

    return {
        status: 'created' as const,
        incident,
        onRoute,
    };
}