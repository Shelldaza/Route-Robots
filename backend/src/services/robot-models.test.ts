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

// Solo se sustituye PostgreSQL. El esquema, el servicio y el repositorio
// se ejecutan juntos para verificar qué datos llegan a la persistencia.
vi.mock('../db', () => ({
    pool: {
        query: queryMock,
    },
}));

import {
    listRobotModels,
    registerRobotModel,
    RobotModelConflictError,
} from './robot-models';

const input = {
    name: 'Modelo de prueba',
    speedKmh: 4,
    batteryCapacityWh: 500,
    consumptionWhPerKm: 40,
    dataSource: 'unknown',
};

const saved = {
    id: '77d9db16-4503-4b17-9077-61165a779fb0',
    ...input,
    maxSlopePercent: null,
    widthMeters: null,
    lengthMeters: null,
    lateralMarginMeters: null,
    sourceNotes: null,
    createdAt: new Date('2026-10-21T00:00:00.000Z'),
};

describe('Servicio de modelos de robots', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it('conserva medidas desconocidas como null y normaliza el nombre', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [saved],
        });

        const result = await registerRobotModel({
            ...input,
            name: '  Modelo de prueba  ',
        });

        expect(result).toEqual(saved);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining(
                'INSERT INTO robot_models',
            ),
            [
                'Modelo de prueba',
                4,
                500,
                40,
                null,
                null,
                null,
                null,
                'unknown',
                null,
            ],
        );
    });

    it('conserva ceros válidos y normaliza la referencia documentada', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                ...saved,
                maxSlopePercent: 0,
                lateralMarginMeters: 0,
                dataSource: 'documented',
                sourceNotes: 'Ficha técnica, revisión 1',
            }],
        });

        await registerRobotModel({
            ...input,
            maxSlopePercent: 0,
            lateralMarginMeters: 0,
            dataSource: 'documented',
            sourceNotes: '  Ficha técnica, revisión 1  ',
        });

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            [
                input.name,
                4,
                500,
                40,
                0,
                null,
                null,
                0,
                'documented',
                'Ficha técnica, revisión 1',
            ],
        );
    });

    it.each(['documented', 'measured'])(
        'exige una referencia para datos de origen %s',
        async (dataSource) => {
            await expect(
                registerRobotModel({
                    ...input,
                    dataSource,
                    sourceNotes: '   ',
                }),
            ).rejects.toMatchObject({
                issues: expect.arrayContaining([
                    expect.objectContaining({
                        path: ['sourceNotes'],
                    }),
                ]),
            });

            expect(queryMock).not.toHaveBeenCalled();
        },
    );

    it.each([
        { widthMeters: 0 },
        { lengthMeters: -1 },
        { lateralMarginMeters: -0.1 },
        { speedKmh: Infinity },
        { unknownField: true },
    ])(
        'rechaza datos inválidos antes de persistir: %j',
        async (changes) => {
            await expect(
                registerRobotModel({
                    ...input,
                    ...changes,
                }),
            ).rejects.toThrow();

            expect(queryMock).not.toHaveBeenCalled();
        },
    );

    it('informa el conflicto de un nombre duplicado', async () => {
        queryMock.mockRejectedValueOnce({
            code: '23505',
        });

        await expect(
            registerRobotModel(input),
        ).rejects.toEqual(
            new RobotModelConflictError(),
        );
    });

    it('rechaza un INSERT que no devuelve el modelo registrado', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            registerRobotModel(input),
        ).rejects.toThrow(
            'La base no devolvió el modelo registrado.',
        );
    });

    it('propaga fallos inesperados sin clasificarlos como duplicados', async () => {
        const failure = new Error(
            'Conexión no disponible',
        );

        queryMock.mockRejectedValueOnce(failure);

        await expect(
            registerRobotModel(input),
        ).rejects.toBe(failure);
    });

    it('devuelve un catálogo vacío cuando no hay modelos', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            listRobotModels(),
        ).resolves.toEqual([]);
    });
});