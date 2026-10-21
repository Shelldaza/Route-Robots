import {
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';

import {
    areaBounds,
    lineHits,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
    SurfaceImpact,
} from '../../../shared/surfaces';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import {
    pedestrianNetwork,
    routeOnPedestrianNetwork,
    distanceMeters,
} from './pedestrian-network';

import type {
    PedestrianNetwork,
    PedestrianSegment,
} from './pedestrian-network';

import type {
    PedestrianRouteInput,
} from './pedestrian-compact';

vi.mock('./surface-incidents', () => ({
    robotRadius: () => 0.375,
}));

vi.mock('./routing', async () => {
    const actual = await vi.importActual<
        typeof import('./routing')
    >('./routing');

    return {
        ...actual,

        calculateRoute: (
            input: PedestrianRouteInput,
        ) => {
            try {
                return routeOnPedestrianNetwork(
                    input,
                    network,
                );
            } catch (error) {
                throw new actual.RoutingError(
                    422,
                    error instanceof Error
                        ? error.message
                        : 'Sin ruta',
                );
            }
        },
    };
});

vi.mock('./pedestrian-spatial', () => ({
    queryPedestrianSegments: () =>
        network.segments,
}));

import {
    calculateSurfaceRoute,
} from './surface-routing';

const point = (
    x: number,
    y: number,
): Point => world(
    [x, y],
    [-77.04, 38.9],
);

function segment(
    id: string,
    from: string,
    to: string,
    a: Point,
    b: Point,
): PedestrianSegment {
    return {
        id,
        from,
        to,
        coordinates: [a, b],
        wayId: 1,
        name: '',
        kind: 'sidewalk',
    };
}

// Tramo vertical de cien metros.
const main = segment(
    'main',
    'south',
    'north',
    point(0, 0),
    point(0, 100),
);

// Desvío conectado mediante los cruces de ambos extremos.
const alternate = [
    segment(
        'south-crossing',
        'south',
        'southwest',
        point(0, 0),
        point(-20, 0),
    ),
    segment(
        'west',
        'southwest',
        'northwest',
        point(-20, 0),
        point(-20, 100),
    ),
    segment(
        'north-crossing',
        'northwest',
        'north',
        point(-20, 100),
        point(0, 100),
    ),
];

let network: PedestrianNetwork;

beforeEach(() => {
    network = {
        ...pedestrianNetwork,
        version: 'recovery-test',
        segments: [
            main,
            ...alternate,
        ],
    };
});

function rectangle(
    x: number,
    y: number,
    width: number,
    height: number,
): Area {
    return {
        type: 'MultiPolygon',
        coordinates: [[[
            point(x, y),
            point(x + width, y),
            point(x + width, y + height),
            point(x, y + height),
            point(x, y),
        ]]],
    };
}

// La obra cierra todo el ancho de la vereda.
const geometry = rectangle(-1, 60, 2, 1);

const impact: SurfaceImpact = {
    geometry,
    collisionGeometry: geometry,
    surfaces: [{
        id: 1,
        code: 1480,
        capturedAt: null,
        geometry: rectangle(-1, 50, 2, 50),
    }],
    segmentIds: ['main'],
    source: 'test',
    retrievedAt: '2026-10-21',
    box: {
        center: point(0, 60.5),
        halfWidth: 1,
        halfLength: 0.5,
        angle: 0,
    },
    unknown: false,
};

const incident: SurfaceIncident = {
    id: 'incident',
    simulationId: 'sim',
    type: 'roadworks',
    source: 'manual',
    description: 'Cierre transversal',
    effect: 'blockage',
    reporterName: 'Usuario',
    blockedArea: areaBounds(geometry),
    surfaceImpact: impact,
    createdAt: new Date(),
    startsAt: new Date(),
    expiresAt: new Date(),
};

const context: SurfaceContext = {
    simulationId: 'sim',
    robotId: 'robot',
    networkVersion: 'recovery-test',
    widthMeters: 0.45,
    lateralMarginMeters: 0.15,
};

const start = point(0, 40);
const finish = point(0, 90);

const input = {
    origin: {
        lng: start[0],
        lat: start[1],
    },
    destination: {
        lng: finish[0],
        lat: finish[1],
    },
    networkVersion: 'recovery-test',
    strictOrigin: true,
};

it(
    'retrocede hasta el cruce, usa la vereda conectada y conserva ambos extremos',
    async () => {
        const result = await calculateSurfaceRoute(
            input,
            context,
            [incident],
        );

        const coordinates =
            result.geometry.coordinates;

        expect(
            distanceMeters(
                coordinates[0]!,
                start,
            ),
        ).toBeLessThan(0.001);

        expect(
            distanceMeters(
                coordinates.at(-1)!,
                finish,
            ),
        ).toBeLessThan(0.001);

        expect(
            coordinates.some((p) =>
                distanceMeters(
                    p,
                    point(0, 0),
                ) < 0.001
            ),
        ).toBe(true);

        expect(
            result.segmentIds,
        ).toContain('west');

        expect(
            lineHits(
                coordinates,
                geometry,
            ),
        ).toBe(false);

        // 40 m de retirada + 140 m de desvío + 10 m de llegada.
        // La distancia debe incluir todo el movimiento.
        expect(
            result.distanceMeters,
        ).toBeGreaterThan(189);

        expect(
            result.distanceMeters,
        ).toBeLessThan(191);
    },
);

it(
    'no inventa una conexión cuando la vereda alternativa está desconectada',
    async () => {
        network = {
            ...network,
            segments: [
                main,
                alternate[0]!,
                alternate[2]!,
            ],
        };

        await expect(
            calculateSurfaceRoute(
                input,
                context,
                [incident],
            ),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    },
);

it(
    'no habilita un tramo cerrado explícitamente por su identificador',
    async () => {
        await expect(
            calculateSurfaceRoute(
                {
                    ...input,
                    blockedSegmentIds: ['main'],
                },
                context,
                [incident],
            ),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    },
);

it(
    'rechaza una retirada que también atraviesa un obstáculo',
    async () => {
        const other = rectangle(-1, 20, 2, 1);

        const second: SurfaceIncident = {
            ...incident,
            id: 'south-block',
            surfaceImpact: {
                ...impact,
                geometry: other,
                collisionGeometry: other,
                surfaces: [{
                    ...impact.surfaces[0]!,
                    id: 2,
                    geometry: rectangle(-1, 0, 2, 50),
                }],
            },
            blockedArea: areaBounds(other),
        };

        await expect(
            calculateSurfaceRoute(
                input,
                context,
                [incident, second],
            ),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    },
);

it(
    'no une líneas coincidentes si sus nodos no están conectados',
    async () => {
        network = {
            ...network,
            segments: [
                main,
                alternate[0]!,
                {
                    ...alternate[1]!,
                    from: 'isolated',
                },
                alternate[2]!,
            ],
        };

        await expect(
            calculateSurfaceRoute(
                input,
                context,
                [incident],
            ),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    },
);

it(
    'no saca al robot desde dentro del margen de un obstáculo',
    async () => {
        const inside = point(0, 60.5);

        await expect(
            calculateSurfaceRoute(
                {
                    ...input,
                    origin: {
                        lng: inside[0],
                        lat: inside[1],
                    },
                },
                context,
                [incident],
            ),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    },
);