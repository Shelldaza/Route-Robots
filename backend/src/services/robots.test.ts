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

// Se sustituye solo PostgreSQL. Se ejecutan el esquema, el servicio
// y el repositorio reales para comprobar su integración.
vi.mock('../db', () => ({
    pool: {
        query: queryMock,
    },
}));

import {
    listRobots,
    registerRobot,
    RobotRegistrationError,
} from './robots';

const modelId = '10000000-0000-4000-8000-000000000001';

const input = {
    name: 'RR-01',
    modelId,
};

describe('Servicio de robots', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it('normaliza el nombre y solo persiste nombre y modelo', async () => {
        const stored = {
            id: '20000000-0000-4000-8000-000000000001',
            ...input,
        };

        queryMock.mockResolvedValueOnce({
            rows: [stored],
        });

        const result = await registerRobot({
            ...input,
            name: '  RR-01  ',
        });

        expect(result).toEqual(stored);

        expect(queryMock).toHaveBeenCalledTimes(1);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining(
                'INSERT INTO robots (name, model_id)',
            ),
            ['RR-01', modelId],
        );
    });

    it.each([
        { name: '   ' },
        { modelId: 'inventado' },
        { speedKmh: 999 },
        { widthMeters: 0.01 },
    ])(
        'rechaza datos inválidos sin consultar PostgreSQL: %j',
        async (changes) => {
            await expect(
                registerRobot({
                    ...input,
                    ...changes,
                }),
            ).rejects.toThrow();

            expect(queryMock).not.toHaveBeenCalled();
        },
    );

    it('distingue un modelo inexistente de un fallo de base', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            registerRobot(input),
        ).rejects.toMatchObject({
            name: 'RobotRegistrationError',
            reason: 'model_not_found',
        });
    });

    it('convierte una violación de unicidad en un conflicto de registro', async () => {
        queryMock.mockRejectedValueOnce({
            code: '23505',
            detail: 'Detalle interno de PostgreSQL',
        });

        await expect(
            registerRobot(input),
        ).rejects.toEqual(
            new RobotRegistrationError(
                'duplicate_name',
                'Ya existe un robot con ese nombre o identificador.',
            ),
        );
    });

    it('propaga errores inesperados sin confundirlos con duplicados', async () => {
        const failure = new Error(
            'Conexión no disponible',
        );

        queryMock.mockRejectedValueOnce(failure);

        await expect(
            registerRobot(input),
        ).rejects.toBe(failure);
    });

    it('devuelve una lista vacía cuando no hay unidades', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            listRobots(),
        ).resolves.toEqual([]);
    });
});