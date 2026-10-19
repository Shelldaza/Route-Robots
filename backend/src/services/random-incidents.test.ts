import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import type {
    PedestrianSegment,
} from './pedestrian-network';

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    list: vi.fn(),
    nearby: vi.fn(),
}));

vi.mock('./incidents', async (importOriginal) => {
    const original = await importOriginal<
        typeof import('./incidents')
    >();

    return {
        ...original,
        createIncident: mocks.create,
        findIncidentById: mocks.find,
        listIncidents: mocks.list,
    };
});

vi.mock('../db', () => ({
    pool: { query: vi.fn() },
}));

vi.mock(
    './pedestrian-network',
    async (importOriginal) => {
        const original = await importOriginal<
            typeof import('./pedestrian-network')
        >();

        return {
            ...original,
            queryCompactSegments: mocks.nearby,
        };
    },
);

import {
    pedestrianNetwork,
} from './pedestrian-network';

import {
    createRouteMatcher,
    generateRandomIncident,
    isRouteReport,
    randomIncidentId,
    randomIncidentSchema,
} from './random-incidents';

const simulationId =
    '21bd592c-0da1-43d4-9307-8494429bd15b';

const generationId =
    'f88bbd1b-dc80-4339-b734-a82b717d51db';

const coordinates: [number, number][] = Array.from(
    { length: 11 },
    (_, index) => [-77 + index * 0.0002, 38.9],
);

function segment(
    id: string,
    lat: number,
): PedestrianSegment {
    return {
        id,
        wayId: 1,
        from: `${id}-a`,
        to: `${id}-b`,
        name: '',
        kind: 'sidewalk',
        coordinates: [
            [-76.9994, lat],
            [-76.9993, lat],
        ],
    };
}

const on = segment('on', 38.9);
const off = segment('off', 38.9002);

const input = {
    simulationId,
    generationId,
    index: 0,
    scenarioTime: '2026-10-19T12:00:00Z',
    networkVersion: pedestrianNetwork.version,
    coordinates,
};

const seed = `${simulationId}:${generationId}`;

const indices = Array.from(
    { length: 100 },
    (_, index) => index,
);

const routeIndex = indices.find(
    (index) => isRouteReport(seed, index),
)!;

const offIndex = indices.find(
    (index) => !isRouteReport(seed, index),
)!;

beforeEach(() => {
    vi.clearAllMocks();

    mocks.find.mockResolvedValue(null);
    mocks.list.mockResolvedValue([]);
    mocks.nearby.mockReturnValue([on, off]);

    mocks.create.mockImplementation(
        async (value, id) => ({ ...value, id }),
    );
});

describe('Distribución y geometría', () => {
    it('reserva 15 posiciones por cada bloque de 100', () => {
        for (let batch = 0; batch < 10; batch++) {
            const slots = indices.map(
                (index) =>
                    isRouteReport(
                        seed,
                        batch * 100 + index,
                    ),
            );

            expect(
                slots.filter(Boolean),
            ).toHaveLength(15);
        }
    });

    it('reproduce la distribución con la misma semilla', () => {
        const series = (value: string) =>
            indices.map(
                (index) => isRouteReport(value, index),
            );

        expect(series(seed)).toEqual(series(seed));
        expect(series(seed))
            .not.toEqual(series('otra-flota'));
    });

    it('distingue la otra vereda y el contacto con una esquina', () => {
        const matches = createRouteMatcher(coordinates);

        expect(matches(on)).toBe(true);
        expect(matches(off)).toBe(false);

        expect(matches({
            ...on,
            coordinates: [
                [-76.9994, 38.9],
                [-76.9994, 38.9001],
            ],
        })).toBe(false);
    });

    it('excluye el recorrido que quedó atrás', () => {
        const matches =
            createRouteMatcher(coordinates.slice(4));

        expect(matches(on)).toBe(false);
    });

    it('rechaza rutas sin sus puntos intermedios', () => {
        const result = randomIncidentSchema.safeParse({
            ...input,
            coordinates: [
                coordinates[0],
                coordinates.at(-1),
            ],
        });

        expect(result.success).toBe(false);
    });
});

describe('Creación de reportes', () => {
    it('elige un tramo sobre la ruta y conserva la fecha', async () => {
        const result = await generateRandomIncident({
            ...input,
            index: routeIndex,
        });

        expect(result.status).toBe('created');

        expect(mocks.create).toHaveBeenCalledWith(
            expect.objectContaining({
                startsAt: input.scenarioTime,
                source: 'simulation',
                pedestrianSelection: {
                    networkVersion: input.networkVersion,
                    scope: 'segment',
                    segmentIds: ['on'],
                },
            }),
            expect.any(String),
        );
    });

    it('elige fuera del recorrido cuando corresponde', async () => {
        const result = await generateRandomIncident({
            ...input,
            index: offIndex,
        });

        expect(result.status).toBe('created');

        expect(
            mocks.create.mock.calls[0]![0]
                .pedestrianSelection.segmentIds,
        ).toEqual(['off']);
    });

    it('no superpone reportes en un tramo ocupado', async () => {
        mocks.list.mockResolvedValue([
            {
                pedestrianImpact: {
                    segmentIds: ['off'],
                },
            },
        ]);

        const result = await generateRandomIncident({
            ...input,
            index: offIndex,
        });

        expect(result.status).toBe('skipped');
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('no inventa una ubicación si no hay un tramo adecuado', async () => {
        mocks.nearby.mockReturnValue([off]);

        const result = await generateRandomIncident({
            ...input,
            index: routeIndex,
        });

        expect(result.status).toBe('skipped');
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('recupera el evento guardado al reintentar', async () => {
        const existing = {
            id: randomIncidentId(
                simulationId,
                generationId,
                routeIndex,
            ),
        };

        mocks.find.mockResolvedValue(existing);

        const result = await generateRandomIncident({
            ...input,
            index: routeIndex,
        });

        expect(result).toMatchObject({
            status: 'created',
            incident: existing,
            onRoute: true,
        });

        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.nearby).not.toHaveBeenCalled();
    });

    it('genera IDs distintos entre eventos y simulaciones', () => {
        const first = randomIncidentId(
            simulationId,
            generationId,
            0,
        );

        expect(first).toBe(
            randomIncidentId(
                simulationId,
                generationId,
                0,
            ),
        );

        expect(first).not.toBe(
            randomIncidentId(
                simulationId,
                generationId,
                1,
            ),
        );

        expect(first).not.toBe(
            randomIncidentId(
                generationId,
                generationId,
                0,
            ),
        );
    });

    it('rechaza otra versión de red antes de consultar', async () => {
        await expect(
            generateRandomIncident({
                ...input,
                networkVersion: 'vieja',
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(mocks.find).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe('Captura completa de Washington', () => {
    it('genera 100 reportes: 15 sobre la ruta y 85 fuera', async () => {
        const real = await vi.importActual<
            typeof import('./pedestrian-network')
        >('./pedestrian-network');

        const route = real.routeOnPedestrianNetwork({
            origin: {
                lat: 38.865006,
                lng: -77.1299724,
            },
            destination: {
                lat: 38.9964439,
                lng: -76.9004689,
            },
        });

        mocks.nearby.mockImplementation(
            real.queryCompactSegments,
        );

        const saved: {
            pedestrianImpact: {
                segmentIds: string[];
            };
        }[] = [];

        mocks.list.mockImplementation(
            async () => saved,
        );

        mocks.create.mockImplementation(
            async (value, id) => {
                const result = {
                    ...value,
                    id,
                    pedestrianImpact:
                        real.resolvePedestrianSelection(
                            value.pedestrianSelection,
                        ),
                };

                saved.push(result);
                return result;
            },
        );

        const matches = createRouteMatcher(
            route.geometry.coordinates,
        );

        const ids = new Set<string>();
        let routeCount = 0;

        for (let index = 0; index < 100; index++) {
            const result =
                await generateRandomIncident({
                    ...input,
                    index,
                    coordinates:
                        route.geometry.coordinates,
                });

            expect(result.status).toBe('created');

            if (result.status !== 'created') {
                throw new Error(
                    'Faltan tramos para la prueba.',
                );
            }

            const impact =
                result.incident.pedestrianImpact!;

            const actual =
                matches(impact.segments[0]!);

            expect(actual).toBe(result.onRoute);

            if (actual) routeCount++;

            ids.add(impact.segmentIds[0]!);
        }

        expect(routeCount).toBe(15);
        expect(ids.size).toBe(100);
    }, 15000);
});