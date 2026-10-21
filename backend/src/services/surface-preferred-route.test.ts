import {
    expect,
    it,
    vi,
} from 'vitest';

import {
    areaBounds,
    contains,
    lineHits,
    local,
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

const mocks = vi.hoisted(() => ({
    calculate: vi.fn(),
}));

vi.mock('./routing', () => ({
    calculateRoute: mocks.calculate,

    RoutingError: class extends Error {
        constructor(
            public statusCode: number,
            message: string,
        ) {
            super(message);
        }
    },
}));

vi.mock('./pedestrian-spatial', () => ({
    queryPedestrianSegments: () => [],
}));

vi.mock('./pedestrian-network', () => ({
    distanceMeters: (
        a: Point,
        b: Point,
    ) => Math.hypot(...local(a, b)),
}));

vi.mock('./surface-incidents', () => ({
    robotRadius: () => 0.375,
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

const rectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
): Area => ({
    type: 'MultiPolygon',
    coordinates: [[[
        point(x, y),
        point(x + width, y),
        point(x + width, y + height),
        point(x, y + height),
        point(x, y),
    ]]],
});

const geometry = rectangle(0, 8, 0.8, 1);

const sidewalk = {
    id: 1,
    code: 1480,
    capturedAt: null,
    geometry: rectangle(0, 0, 2, 20),
};

const impact: SurfaceImpact = {
    geometry,
    collisionGeometry: geometry,
    surfaces: [sidewalk],
    segmentIds: ['a'],
    source: 'official',
    retrievedAt: '2026-10-21',
    box: {
        center: point(0.4, 8.5),
        halfWidth: 0.4,
        halfLength: 0.5,
        angle: 0,
    },
    unknown: false,
};

const incident: SurfaceIncident = {
    id: 'incident',
    simulationId: 'sim',
    type: 'pothole',
    source: 'manual',
    description: 'Bache',
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
    networkVersion: 'test',
    widthMeters: 0.45,
    lateralMarginMeters: 0.15,
};

it(
    'descarta el rodeo inventado y obtiene un paso local dentro de la vereda',
    async () => {
        const start = point(1, 1);
        const finish = point(1, 19);

        // Este rodeo evita el obstáculo, pero se aleja diez metros:
        // abandona la vereda y no tiene respaldo en el grafo.
        const invented: Point[] = [
            start,
            point(10, 5),
            point(10, 15),
            finish,
        ];

        mocks.calculate.mockResolvedValue({
            geometry: {
                type: 'LineString',
                coordinates: [start, finish],
            },
            distanceMeters: 18,
            durationSeconds: 13,
            profile: 'foot-walking',
            networkVersion: 'test',
            provider: 'pedestrian-sandbox',
            segmentIds: ['a'],
        });

        const route = await calculateSurfaceRoute(
            {
                origin: {
                    lng: start[0],
                    lat: start[1],
                },
                destination: {
                    lng: finish[0],
                    lat: finish[1],
                },
                networkVersion: 'test',
                blockedSegmentIds: [],
            },
            context,
            [incident],
            [],
            invented,
        );

        expect(
            route.geometry.coordinates[0],
        ).toEqual(start);

        expect(
            route.geometry.coordinates.at(-1),
        ).toEqual(finish);

        expect(
            route.geometry.coordinates.every((p) =>
                contains(sidewalk.geometry, p)
            ),
        ).toBe(true);

        expect(
            lineHits(
                route.geometry.coordinates,
                geometry,
            ),
        ).toBe(false);

        expect(
            route.geometry.coordinates,
        ).not.toEqual(invented);

        expect(
            mocks.calculate,
        ).toHaveBeenCalledTimes(1);
    },
);

it(
    'conserva una maniobra local válida sin recalcular otra ruta',
    async () => {
        mocks.calculate.mockClear();

        const start = point(1, 1);
        const finish = point(1, 19);

        const route = await calculateSurfaceRoute(
            {
                origin: {
                    lng: start[0],
                    lat: start[1],
                },
                destination: {
                    lng: finish[0],
                    lat: finish[1],
                },
                networkVersion: 'test',
                blockedSegmentIds: [],
            },
            context,
            [incident],
            [],
            [start, finish],
        );

        expect(
            mocks.calculate,
        ).not.toHaveBeenCalled();

        expect(
            route.geometry.coordinates[0],
        ).toEqual(start);

        expect(
            route.geometry.coordinates.at(-1),
        ).toEqual(finish);

        expect(
            route.geometry.coordinates.length,
        ).toBeGreaterThan(2);

        expect(
            route.geometry.coordinates.every((p) =>
                contains(sidewalk.geometry, p)
            ),
        ).toBe(true);

        expect(
            lineHits(
                route.geometry.coordinates,
                geometry,
            ),
        ).toBe(false);
    },
);