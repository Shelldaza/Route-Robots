import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

const { queryMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
}));

vi.mock('../db', () => ({
    pool: {
        query: queryMock,
    },
}));

// El registro solo necesita conocer la versión actual.
// Estos tests no evalúan conectividad ni geometrías de la red.
vi.mock('./pedestrian-network', () => ({
    pedestrianNetwork: {
        version: 'test-network',
    },
}));

import {
    getSurfaceContext,
    registerSurfaceContext,
    robotRadius,
} from './surface-context';

const input = {
    simulationId: '10000000-0000-4000-8000-000000000001',
    robotId: '20000000-0000-4000-8000-000000000001',
    networkVersion: 'test-network',
};

const context = {
    ...input,
    widthMeters: 0.6,
    lateralMarginMeters: 0.15,
};

describe('Contexto de superficies', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it('devuelve las dimensiones persistidas del escenario', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [context],
            });

        await expect(
            registerSurfaceContext(input),
        ).resolves.toEqual(context);

        expect(queryMock).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining(
                'ON CONFLICT (simulation_id) DO NOTHING',
            ),
            [
                input.simulationId,
                input.robotId,
                input.networkVersion,
            ],
        );
    });

    it('rechaza otra versión antes de intentar persistir', async () => {
        await expect(
            registerSurfaceContext({
                ...input,
                networkVersion: 'otra-red',
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(queryMock).not.toHaveBeenCalled();
    });

    it('informa que el robot no existe si no se crea ni encuentra contexto', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

        await expect(
            registerSurfaceContext(input),
        ).rejects.toMatchObject({
            statusCode: 404,
            message: 'El robot no existe.',
        });
    });

    it.each([
        {
            robotId: '30000000-0000-4000-8000-000000000001',
        },
        {
            networkVersion: 'version-anterior',
        },
    ])(
        'impide reutilizar un escenario con otra asociación: %j',
        async (changes) => {
            queryMock
                .mockResolvedValueOnce({
                    rows: [],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        ...context,
                        ...changes,
                    }],
                });

            await expect(
                registerSurfaceContext(input),
            ).rejects.toMatchObject({
                statusCode: 409,
                message:
                    'El escenario ya tiene otro robot o red.',
            });
        },
    );

    it('devuelve null al consultar un contexto inexistente', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            getSurfaceContext(input.simulationId),
        ).resolves.toBeNull();
    });

    it('propaga fallos de persistencia sin inventar un contexto', async () => {
        const failure = new Error(
            'Base no disponible',
        );

        queryMock.mockRejectedValueOnce(failure);

        await expect(
            registerSurfaceContext(input),
        ).rejects.toBe(failure);

        expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it('usa medio ancho más margen como radio de seguridad', () => {
        expect(
            robotRadius(context),
        ).toBeCloseTo(0.45, 12);

        expect(queryMock).not.toHaveBeenCalled();
    });

    it('conserva un margen explícito de cero', () => {
        expect(
            robotRadius({
                ...context,
                lateralMarginMeters: 0,
            }),
        ).toBeCloseTo(0.3, 12);
    });

    it.each([
        { widthMeters: null },
        { lateralMarginMeters: null },
        { widthMeters: 0 },
        { widthMeters: -0.6 },
        { widthMeters: NaN },
        { lateralMarginMeters: -0.1 },
        { lateralMarginMeters: Infinity },
    ])(
        'rechaza dimensiones desconocidas o inválidas: %j',
        (changes) => {
            expect(() =>
                robotRadius({
                    ...context,
                    ...changes,
                }),
            ).toThrow(
                'Completá el ancho y el margen lateral del modelo del robot para evaluar el paso.',
            );
        },
    );
});