import {
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import type {
    SurfaceImpact,
    WalkSurface,
} from '../../../shared/surfaces';

import {
    RoutingError,
} from './routing-error';

import {
    incidentFingerprint,
} from './routing-evaluation';

const mocks = vi.hoisted(() => ({
    history: vi.fn(),
    calculate: vi.fn(),
}));

vi.mock('./surface-incidents', () => ({
    surfaceHistory: mocks.history,
}));

vi.mock('./surface-routing', () => ({
    calculateSurfaceRoute: mocks.calculate,
}));

import {
    createSurfaceEvaluation,
} from './surface-evaluation';

const at = '2026-10-21T12:00:00.000Z';

const context: SurfaceContext = {
    simulationId: 'sim',
    robotId: 'robot',
    networkVersion: 'v1',
    widthMeters: 0.6,
    lateralMarginMeters: 0.15,
};

const surface: WalkSurface = {
    id: 1,
    code: 1480,
    capturedAt: null,

    geometry: {
        type: 'MultiPolygon',

        coordinates: [[[
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
        ]]],
    },
};

const impact: SurfaceImpact = {
    geometry: surface.geometry,
    collisionGeometry: surface.geometry,
    surfaces: [surface],
    segmentIds: [],
    source: 'test',
    retrievedAt: at,
    unknown: false,

    box: {
        center: [0.5, 0.5],
        halfWidth: 1,
        halfLength: 1,
        angle: 0,
    },
};

const incident: SurfaceIncident = {
    id: 'one',
    simulationId: 'sim',
    type: 'pothole',
    effect: 'blockage',
    description: 'Bache',
    source: 'manual',
    reporterName: null,

    blockedArea: {
        south: 0,
        west: 0,
        north: 1,
        east: 1,
    },

    createdAt: new Date(at),
    startsAt: new Date(at),

    expiresAt:
        new Date('2026-10-21T12:15:00Z'),
};

// Estas pruebas verifican la coordinación de consultas.
// La geometría del motor se prueba en surface-routing y surface-geometry.
const route = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [0.5, 0.5],
            [0.8, 0.8],
        ],
    },
};

function evaluation() {
    return createSurfaceEvaluation(
        context,
        at,
        {
            lng: 0.5,
            lat: 0.5,
        },
    );
}

beforeEach(() => {
    mocks.history
        .mockReset()
        .mockResolvedValue([incident]);

    mocks.calculate
        .mockReset()
        .mockResolvedValue(route);
});

it(
    'reutiliza la consulta concurrente y evita historial completo cuando hay ruta',
    async () => {
        const service = evaluation();

        await Promise.all([
            service.listActiveIncidents('sim', at),
            service.listActiveIncidents('sim', at),
            service.calculateRoute({}),
        ]);

        expect(mocks.history)
            .toHaveBeenCalledExactlyOnceWith(
                'sim',
                at,
                false,
            );

        expect(service.getFailure())
            .toBeNull();
    },
);

it(
    'vuelve a leer datos actuales al comprobar cambios',
    async () => {
        const service = evaluation();

        await service.listActiveIncidents(
            'sim',
            at,
        );

        mocks.history.mockResolvedValueOnce([]);

        expect(
            await service.refreshActiveIncidents!(
                'sim',
                at,
            ),
        ).toEqual([]);

        expect(mocks.history)
            .toHaveBeenCalledTimes(2);
    },
);

it(
    'no convierte precauciones, reportes futuros ni vencidos en bloqueos',
    async () => {
        mocks.history.mockResolvedValue([
            incident,

            {
                ...incident,
                id: 'caution',
                effect: 'caution',
            },

            {
                ...incident,
                id: 'expired',
                expiresAt: new Date(at),
            },

            {
                ...incident,
                id: 'future',

                startsAt:
                    new Date('2026-10-21T12:01:00Z'),
            },
        ]);

        expect(
            await evaluation().listActiveIncidents(
                'sim',
                at,
            ),
        ).toEqual([incident]);
    },
);

it(
    'recupera cartografía histórica sin reactivar el incidente vencido',
    async () => {
        const expired = {
            ...incident,
            id: 'old',
            expiresAt: new Date(at),
            surfaceImpact: impact,
        };

        mocks.history
            .mockResolvedValueOnce([incident])
            .mockResolvedValueOnce([
                incident,
                expired,
            ]);

        mocks.calculate
            .mockRejectedValueOnce(
                new RoutingError(
                    422,
                    'Falta contexto',
                ),
            )
            .mockResolvedValueOnce(route);

        const service = evaluation();

        expect(
            await service.calculateRoute({}),
        ).toEqual(route);

        expect(mocks.history.mock.calls)
            .toEqual([
                ['sim', at, false],
                ['sim', at, true],
            ]);

        // El segundo cálculo recibe únicamente el bloqueo activo.
        expect(
            mocks.calculate.mock.calls[1]?.[2],
        ).toEqual([incident]);

        // Del reporte vencido se recupera solo la cartografía.
        expect(
            mocks.calculate.mock.calls[1]?.[3],
        ).toEqual([surface]);

        expect(service.getFailure())
            .toBeNull();
    },
);

it(
    'conserva el error si el historial no agrega cartografía',
    async () => {
        mocks.calculate.mockRejectedValue(
            new RoutingError(
                422,
                'Sin conexión',
            ),
        );

        const service = evaluation();

        await expect(
            service.calculateRoute({}),
        ).rejects.toThrow('Sin conexión');

        expect(mocks.calculate)
            .toHaveBeenCalledTimes(1);

        expect(
            service.getFailure()?.statusCode,
        ).toBe(422);
    },
);

it(
    'no busca historial ante un error distinto de falta de ruta',
    async () => {
        mocks.calculate.mockRejectedValue(
            new RoutingError(
                409,
                'Red cambió',
            ),
        );

        await expect(
            evaluation().calculateRoute({}),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(mocks.history)
            .toHaveBeenCalledExactlyOnceWith(
                'sim',
                at,
                false,
            );
    },
);

it(
    'rechaza otra simulación o fecha antes de consultar',
    async () => {
        const service = evaluation();

        await expect(
            service.listActiveIncidents(
                'other',
                at,
            ),
        ).rejects.toMatchObject({
            statusCode: 400,
        });

        await expect(
            service.refreshActiveIncidents!(
                'sim',
                'other',
            ),
        ).rejects.toMatchObject({
            statusCode: 400,
        });

        expect(mocks.history)
            .not.toHaveBeenCalled();
    },
);

it(
    'detecta cambios de superficie aunque el ID del incidente sea el mismo',
    () => {
        const original = {
            ...incident,
            surfaceImpact: impact,
        };

        const changed =
            structuredClone(original);

        changed.surfaceImpact
            .geometry
            .coordinates[0]![0]![1] = [0.9, 0];

        expect(
            incidentFingerprint([original]),
        ).not.toBe(
            incidentFingerprint([changed]),
        );
    },
);