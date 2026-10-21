import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    areaBounds,
    boxArea,
} from '../../../shared/surfaces';

import type {
    SurfaceImpact,
} from '../../../shared/surfaces';

const {
    connectMock,
    queryMock,
    releaseMock,
} = vi.hoisted(() => ({
    connectMock: vi.fn(),
    queryMock: vi.fn(),
    releaseMock: vi.fn(),
}));

// Se sustituyen únicamente el pool y el cliente de PostgreSQL.
// El servicio y el repositorio se ejecutan juntos.
vi.mock('../db', () => ({
    pool: {
        connect: connectMock,
    },
}));

import {
    pedestrianNetwork,
} from './pedestrian-network';

import {
    saveSurfaceReport,
} from './surface-incidents';

import type {
    SurfaceReport,
} from './surface-incidents';

const box = {
    center: [-77.04, 38.9] as [number, number],
    halfWidth: 0.5,
    halfLength: 0.5,
    angle: 0,
};

const geometry = boxArea(box);

const impact: SurfaceImpact = {
    geometry,
    collisionGeometry: geometry,

    surfaces: [{
        id: 1,
        code: 1480,
        capturedAt: null,
        geometry,
    }],

    segmentIds: [],
    source: 'fixture',
    retrievedAt: '2026-10-21T12:00:00.000Z',
    box,
    unknown: false,
};

const input: SurfaceReport = {
    id: '10000000-0000-4000-8000-000000000001',
    simulationId: '20000000-0000-4000-8000-000000000001',
    networkVersion: pedestrianNetwork.version,
    scenarioTime: '2026-10-21T12:00:00.000Z',
    coordinates: [],
    box,
    type: 'pothole',
    effect: 'caution',
    description: 'Bache de prueba',
    startsAt: '2026-10-21T12:00:00.000Z',
    durationMinutes: 15,
    multipleSurfaces: false,
};

function statements(): string[] {
    return queryMock.mock.calls.map(([sql]) =>
        String(sql).replace(/\s+/g, ' ').trim()
    );
}

describe('Persistencia de reportes de superficies', () => {
    beforeEach(() => {
        connectMock.mockReset();
        queryMock.mockReset();
        releaseMock.mockReset();

        connectMock.mockResolvedValue({
            query: queryMock,
            release: releaseMock,
        });

        queryMock.mockResolvedValue({
            rows: [],
        });
    });

    it('confirma el incidente y su geometría utilizando el mismo cliente', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [{ id: input.id }],
            });

        await expect(
            saveSurfaceReport(input, impact),
        ).resolves.toEqual({
            id: input.id,
            simulationId: input.simulationId,
        });

        expect(connectMock).toHaveBeenCalledTimes(1);

        expect(statements()).toEqual([
            'BEGIN',
            expect.stringContaining(
                'INSERT INTO incidents',
            ),
            expect.stringContaining(
                'INSERT INTO incident_surfaces',
            ),
            'COMMIT',
        ]);

        const bounds = areaBounds(
            geometry,
            0.01,
        );

        expect(
            queryMock.mock.calls[1]![1],
        ).toEqual([
            input.id,
            input.simulationId,
            'pothole',
            input.description,
            'caution',
            bounds.south,
            bounds.west,
            bounds.north,
            bounds.east,
            new Date(input.startsAt),
            new Date('2026-10-21T12:15:00.000Z'),
            null,
        ]);

        expect(
            queryMock.mock.calls[2]![1],
        ).toEqual([
            input.id,
            JSON.stringify(impact),
        ]);

        expect(
            releaseMock,
        ).toHaveBeenCalledExactlyOnceWith();
    });

    it('acepta un reintento coincidente sin volver a insertar la geometría', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [{ id: input.id }],
            });

        await expect(
            saveSurfaceReport(input, impact),
        ).resolves.toEqual({
            id: input.id,
            simulationId: input.simulationId,
        });

        expect(statements()).toEqual([
            'BEGIN',
            expect.stringContaining(
                'INSERT INTO incidents',
            ),
            expect.stringContaining('SELECT i.id'),
            'COMMIT',
        ]);

        expect(
            queryMock.mock.calls[2]![1],
        ).toEqual([
            input.id,
            input.simulationId,
            input.type,
            input.description,
            new Date(input.startsAt),
            new Date('2026-10-21T12:15:00.000Z'),
            JSON.stringify(input.box),
            'caution',
        ]);

        expect(
            releaseMock,
        ).toHaveBeenCalledExactlyOnceWith();
    });

    it('revierte y devuelve conflicto si el ID corresponde a otro reporte', async () => {
        await expect(
            saveSurfaceReport(input, impact),
        ).rejects.toMatchObject({
            statusCode: 409,
            message:
                'Ese identificador ya pertenece a otro reporte.',
        });

        expect(statements()).toEqual([
            'BEGIN',
            expect.stringContaining(
                'INSERT INTO incidents',
            ),
            expect.stringContaining('SELECT i.id'),
            'ROLLBACK',
        ]);

        expect(
            releaseMock,
        ).toHaveBeenCalledExactlyOnceWith();
    });

    it.each([
        'BEGIN',
        'INSERT INTO incidents',
        'INSERT INTO incident_surfaces',
        'COMMIT',
    ])(
        'revierte y conserva el error cuando falla %s',
        async (stage) => {
            const failure = new Error(
                'Fallo de persistencia',
            );

            queryMock.mockImplementation(
                async (sql: string) => {
                    if (sql.includes(stage)) {
                        throw failure;
                    }

                    return {
                        rows: sql.includes(
                            'INSERT INTO incidents',
                        )
                            ? [{ id: input.id }]
                            : [],
                    };
                },
            );

            await expect(
                saveSurfaceReport(input, impact),
            ).rejects.toBe(failure);

            expect(
                statements().at(-1),
            ).toBe('ROLLBACK');

            expect(
                releaseMock,
            ).toHaveBeenCalledExactlyOnceWith();

            if (stage !== 'COMMIT') {
                expect(
                    statements(),
                ).not.toContain('COMMIT');
            }
        },
    );

    it('conserva el error original y descarta la conexión si falla el rollback', async () => {
        const original = new Error(
            'Falló el INSERT',
        );

        const rollback = new Error(
            'Falló el ROLLBACK',
        );

        queryMock
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockRejectedValueOnce(original)
            .mockRejectedValueOnce(rollback);

        await expect(
            saveSurfaceReport(input, impact),
        ).rejects.toBe(original);

        expect(
            statements().at(-1),
        ).toBe('ROLLBACK');

        expect(
            releaseMock,
        ).toHaveBeenCalledExactlyOnceWith(rollback);
    });

    it('no intenta liberar un cliente que no pudo adquirir', async () => {
        const failure = new Error(
            'Pool no disponible',
        );

        connectMock.mockRejectedValueOnce(failure);

        await expect(
            saveSurfaceReport(input, impact),
        ).rejects.toBe(failure);

        expect(queryMock).not.toHaveBeenCalled();
        expect(releaseMock).not.toHaveBeenCalled();
    });

    it('exige confirmar varias superficies antes de iniciar la transacción', async () => {
        await expect(
            saveSurfaceReport(input, {
                ...impact,
                surfaces: [
                    impact.surfaces[0]!,
                    {
                        ...impact.surfaces[0]!,
                        id: 2,
                    },
                ],
            }),
        ).rejects.toMatchObject({
            statusCode: 400,
        });

        expect(connectMock).not.toHaveBeenCalled();
    });
});