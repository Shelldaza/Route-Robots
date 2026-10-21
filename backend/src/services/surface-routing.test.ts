import {
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';

import {
    world,
    lineHits,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
    SurfaceImpact,
} from '../../../shared/surfaces';

import type {
    SurfaceContext,
    SurfaceIncident,
} from './surface-incidents';

const mocks = vi.hoisted(() => ({
    calculate: vi.fn(),
    query: vi.fn(),
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
    queryPedestrianSegments: mocks.query,
}));

vi.mock('./pedestrian-network', () => ({
    distanceMeters: (a: Point, b: Point) =>
        Math.hypot(
            (a[0] - b[0]) * 86600,
            (a[1] - b[1]) * 111320,
        ),
}));

vi.mock('./surface-incidents', () => ({
    robotRadius: (context: SurfaceContext) =>
        context.widthMeters! / 2
        + context.lateralMarginMeters!,
}));

import {
    calculateSurfaceRoute,
    previewSurfacePath,
    toolIncidents,
} from './surface-routing';

const origin: Point = [-77.04, 38.9];

const point = (
    x: number,
    y: number,
): Point => world([x, y], origin);

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

const impact: SurfaceImpact = {
    geometry: rectangle(0, 8, 1.2, 1),
    collisionGeometry: rectangle(0, 8, 1.2, 1),
    surfaces: [{
        id: 1,
        code: 1480,
        capturedAt: null,
        geometry: rectangle(0, 0, 2, 20),
    }],
    segmentIds: ['a'],
    source: 'official',
    retrievedAt: '2026-10-20',
    box: {
        center: point(0.6, 8.5),
        halfWidth: 0.6,
        halfLength: 0.5,
        angle: 0,
    },
    unknown: false,
};

const incident = {
    id: 'incident',
    effect: 'blockage',
    surfaceImpact: impact,
} as SurfaceIncident;

const context: SurfaceContext = {
    simulationId: 'sim',
    robotId: 'robot',
    networkVersion: 'test',
    widthMeters: 0.45,
    lateralMarginMeters: 0.15,
};

const coordinates = [
    point(1, 1),
    point(1, 19),
];

const input = {
    origin: {
        lng: coordinates[0]![0],
        lat: coordinates[0]![1],
    },
    destination: {
        lng: coordinates[1]![0],
        lat: coordinates[1]![1],
    },
    blockedSegmentIds: [],
};

const route = {
    geometry: {
        type: 'LineString',
        coordinates,
    },
    segmentIds: ['a'],
    distanceMeters: 18,
    durationSeconds: 13,
    profile: 'foot-walking',
    networkVersion: 'test',
    provider: 'pedestrian-sandbox',
};

beforeEach(() => {
    mocks.calculate.mockReset();
    mocks.query.mockReset();
    mocks.query.mockReturnValue([]);
});

it('adapta el recorrido conservando los extremos', async () => {
    mocks.calculate.mockResolvedValue(route);

    const result = await calculateSurfaceRoute(
        input,
        context,
        [incident],
    );

    expect(result.geometry.coordinates[0])
        .toEqual(coordinates[0]);

    expect(result.geometry.coordinates.at(-1))
        .toEqual(coordinates.at(-1));

    expect(result.geometry.coordinates.length)
        .toBeGreaterThan(2);

    expect(
        lineHits(
            result.geometry.coordinates,
            impact.geometry,
        ),
    ).toBe(false);
});

it('reintenta evitando el tramo si el robot ancho no cabe', async () => {
    mocks.query.mockReturnValue([{
        id: 'a',
        coordinates,
    }]);

    mocks.calculate
        .mockResolvedValueOnce(route)
        .mockResolvedValueOnce({
            ...route,
            geometry: {
                type: 'LineString',
                coordinates: [
                    coordinates[0]!,
                    point(3, 1),
                    point(3, 19),
                    coordinates[1]!,
                ],
            },
            segmentIds: ['b'],
        });

    await calculateSurfaceRoute(
        input,
        { ...context, widthMeters: 0.85 },
        [incident],
    );

    expect(
        mocks.calculate.mock.calls[1]![0].blockedSegmentIds,
    ).toEqual(['a']);
});

it('considera los cierres generales contenidos en la superficie', () => {
    const a = point(0.1, 6);
    const b = point(1.9, 7);

    const general = {
        effect: 'blockage',
        blockedArea: {
            west: a[0],
            south: a[1],
            east: b[0],
            north: b[1],
        },
    } as SurfaceIncident;

    expect(
        previewSurfacePath(
            coordinates,
            [impact],
            0.375,
            [general],
        ).state,
    ).not.toBe('local_path');
});

it('envía al agente una restricción de superficie sin impactos ficticios', () => {
    const result = toolIncidents(
        [incident],
        context,
    )[0]!;

    expect(result).not.toHaveProperty('surfaceImpact');
    expect(result).not.toHaveProperty('pedestrianImpact');

    expect(result.restriction).toEqual({
        kind: 'surface',
        networkVersion: context.networkVersion,
    });
});

it('usa superficies de contexto para conectar polígonos contiguos', async () => {
    mocks.calculate.mockResolvedValue(route);

    const first = {
        id: 1,
        code: 1480,
        capturedAt: null,
        geometry: rectangle(0, 0, 2, 8.5),
    };

    const second = {
        id: 2,
        code: 1480,
        capturedAt: null,
        geometry: rectangle(0, 8.5, 2, 11.5),
    };

    const report = {
        ...impact,
        surfaces: [first],
        contextSurfaces: [first, second],
    };

    const result = await calculateSurfaceRoute(
        input,
        context,
        [{
            ...incident,
            surfaceImpact: report,
        }],
    );

    expect(
        lineHits(
            result.geometry.coordinates,
            impact.geometry,
        ),
    ).toBe(false);
});

it('distingue falta de cartografía de un cierre demostrado', async () => {
    const a = point(-0.1, 1);
    const b = point(-0.1, 19);

    mocks.calculate.mockResolvedValue({
        ...route,
        geometry: {
            type: 'LineString',
            coordinates: [a, b],
        },
    });

    await expect(
        calculateSurfaceRoute(
            {
                ...input,
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
            [incident],
        ),
    ).rejects.toThrow('No se pudo verificar');
});

it('no mezcla fuentes cartográficas distintas en una evaluación', async () => {
    mocks.calculate.mockResolvedValue(route);

    await expect(
        calculateSurfaceRoute(
            input,
            context,
            [
                incident,
                {
                    ...incident,
                    id: 'other',
                    surfaceImpact: {
                        ...impact,
                        source: 'another-source',
                    },
                },
            ],
        ),
    ).rejects.toMatchObject({
        statusCode: 409,
    });
});

it.each([
    'caution',
    'informational',
] as const)(
    'un reporte %s no cierra el paso automáticamente',
    async (effect) => {
        mocks.calculate.mockResolvedValue(route);

        const report: SurfaceIncident = {
            ...incident,
            effect,
        };

        const result = await calculateSurfaceRoute(
            input,
            context,
            [report],
        );

        expect(result).toEqual(route);

        expect(mocks.calculate)
            .toHaveBeenCalledTimes(1);

        expect(mocks.query)
            .not.toHaveBeenCalled();

        // El aviso no representa un cierre.
        expect(
            lineHits(
                result.geometry.coordinates,
                impact.geometry,
            ),
        ).toBe(true);
    },
);

it(
    'adapta el recorrido pendiente antes de solicitar otra ruta al grafo',
    async () => {
        const result = await calculateSurfaceRoute(
            {
                ...input,
                networkVersion: context.networkVersion,
            },
            context,
            [incident],
            [],
            coordinates,
        );

        expect(mocks.calculate)
            .not.toHaveBeenCalled();

        expect(result.geometry.coordinates[0])
            .toEqual(coordinates[0]);

        expect(result.geometry.coordinates.at(-1))
            .toEqual(coordinates.at(-1));

        expect(
            lineHits(
                result.geometry.coordinates,
                impact.geometry,
            ),
        ).toBe(false);

        const preview = previewSurfacePath(
            coordinates,
            [impact],
            context.widthMeters! / 2
                + context.lateralMarginMeters!,
            [incident],
        );

        expect(preview.state).toBe('local_path');

        expect(result.geometry.coordinates)
            .toEqual(preview.coordinates);
    },
);

it('consume las referencias de superficie antes de consultar el grafo', async () => {
    mocks.calculate.mockResolvedValue(route);

    const result = await calculateSurfaceRoute(
        {
            ...input,
            networkVersion: context.networkVersion,
            surfaceIncidentIds: [incident.id],
        },
        context,
        [incident],
    );

    expect(mocks.calculate)
        .toHaveBeenCalledTimes(1);

    expect(
        mocks.calculate.mock.calls[0]![0],
    ).not.toHaveProperty('surfaceIncidentIds');

    expect(
        lineHits(
            result.geometry.coordinates,
            impact.geometry,
        ),
    ).toBe(false);
});

it('rechaza una referencia de superficie que ya no está activa', async () => {
    await expect(
        calculateSurfaceRoute(
            {
                ...input,
                networkVersion: context.networkVersion,
                surfaceIncidentIds: ['another-incident'],
            },
            context,
            [incident],
        ),
    ).rejects.toMatchObject({
        statusCode: 409,
    });

    expect(mocks.calculate)
        .not.toHaveBeenCalled();
});