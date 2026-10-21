import {
    expect,
    it,
    vi,
} from 'vitest';

import {
    areaBounds,
    contains,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
    WalkSurface,
} from '../../../shared/surfaces';

import type {
    SurfaceContext,
    SurfaceIncident,
} from './surface-incidents';

vi.mock('./routing', () => ({
    calculateRoute: vi.fn(),

    RoutingError: class extends Error {
        constructor(
            public statusCode: number,
            message: string,
        ) {
            super(message);
        }
    },
}));

vi.mock('./pedestrian-network', () => ({
    distanceMeters: vi.fn(),
}));

vi.mock('./pedestrian-spatial', () => ({
    queryPedestrianSegments: vi.fn(),
}));

vi.mock('./surface-incidents', () => ({
    robotRadius: vi.fn(() => 0.375),
}));

import {
    calculateSurfaceRoute,
    legacyObstacles,
} from './surface-routing';

const origin: Point = [-77.04, 38.9];

const point = (x: number, y: number): Point =>
    world([x, y], origin);

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

const sidewalk: WalkSurface = {
    id: 1,
    code: 1480,
    capturedAt: null,
    geometry: rectangle(0, 0, 2, 20),
};

const segmentReport = {
    effect: 'blockage',
    pedestrianImpact: {
        segments: [{
            coordinates: [
                point(1, 6),
                point(1, 7),
            ],
        }],
    },
} as SurfaceIncident;

it('el rectángulo anterior no cierra toda la vereda', () => {
    const a = point(0.1, 6);
    const b = point(1.9, 7);

    const report = {
        effect: 'blockage',
        blockedArea: {
            west: a[0],
            south: a[1],
            east: b[0],
            north: b[1],
        },
    } as SurfaceIncident;

    const closed = legacyObstacles(
        [sidewalk],
        [report],
    );

    expect(contains(closed, point(1, 6.5))).toBe(true);
    expect(contains(closed, point(1, 15))).toBe(false);
});

it('el tramo anterior cierra solo su sección longitudinal', () => {
    const closed = legacyObstacles(
        [sidewalk],
        [segmentReport],
    );

    expect(contains(closed, point(1, 6.5))).toBe(true);
    expect(contains(closed, point(0.1, 6.5))).toBe(true);
    expect(contains(closed, point(1, 15))).toBe(false);
});

it('mantiene libre la vereda opuesta dentro de un multipolígono', () => {
    const surface: WalkSurface = {
        ...sidewalk,
        geometry: {
            type: 'MultiPolygon',
            coordinates: [
                ...sidewalk.geometry.coordinates,
                ...rectangle(4, 0, 2, 20).coordinates,
            ],
        },
    };

    const closed = legacyObstacles(
        [surface],
        [segmentReport],
    );

    expect(contains(closed, point(1, 6.5))).toBe(true);
    expect(contains(closed, point(5, 6.5))).toBe(false);
});

it('las precauciones antiguas no se convierten en cierres', () => {
    const closed = legacyObstacles(
        [sidewalk],
        [{
            ...segmentReport,
            effect: 'caution',
        }],
    );

    expect(closed.coordinates).toEqual([]);
});

it.each([
    'origin',
    'destination',
] as const)(
    'identifica cuando el incidente alcanza el extremo %s',
    async (endpoint) => {
        const geometry = rectangle(0.5, 6, 1, 1);

        const impact = {
            geometry,
            collisionGeometry: geometry,
            surfaces: [sidewalk],
            segmentIds: [],
            source: 'official',
            retrievedAt: '2026-10-20',
            box: {
                center: point(1, 6.5),
                halfWidth: 0.5,
                halfLength: 0.5,
                angle: 0,
            },
            unknown: false,
        };

        const report: SurfaceIncident = {
            id: 'incident',
            simulationId: 'sim',
            type: 'pothole',
            source: 'manual',
            description: 'Prueba',
            effect: 'blockage',
            reporterName: null,
            blockedArea: areaBounds(geometry),
            createdAt: new Date(),
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            surfaceImpact: impact,
        };

        const context: SurfaceContext = {
            simulationId: 'sim',
            robotId: 'robot',
            networkVersion: 'test',
            widthMeters: 0.45,
            lateralMarginMeters: 0.15,
        };

        const a = endpoint === 'origin'
            ? point(1, 6.5)
            : point(1, 1);

        const b = endpoint === 'destination'
            ? point(1, 6.5)
            : point(1, 19);

        await expect(
            calculateSurfaceRoute(
                {
                    origin: {
                        lng: a[0],
                        lat: a[1],
                    },
                    destination: {
                        lng: b[0],
                        lat: b[1],
                    },
                },
                context,
                [report],
            ),
        ).rejects.toThrow(
            endpoint === 'origin'
                ? 'posición actual'
                : 'destino',
        );
    },
);