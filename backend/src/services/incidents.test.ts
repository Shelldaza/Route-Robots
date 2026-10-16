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

import {
    createIncident,
    listActiveIncidents,
} from './incidents';

const simulationId = '21bd592c-0da1-43d4-9307-8494429bd15b';

const blockedArea = {
    south: 38.908,
    west: -77.035,
    north: 38.909,
    east: -77.034,
};

describe('Servicio de incidentes', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it('guarda el bloqueo asociado a la simulación indicada', async () => {
        const savedIncident = {
            id: 'f88bbd1b-dc80-4339-b734-a82b717d51db',
            simulationId,
            blockedArea,
            type: 'blockage',
            source: 'simulation',
        };

        queryMock.mockResolvedValueOnce({
            rows: [savedIncident],
        });

        const result = await createIncident({
            simulationId,
            blockedArea,
        });

        expect(result).toEqual(savedIncident);
        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            [
                expect.any(String),
                simulationId,
                38.908,
                -77.035,
                38.909,
                -77.034,
            ],
        );
    });

    it('rechaza un bloqueo inválido sin consultar la base', async () => {
        await expect(
            createIncident({
                simulationId,
                blockedArea: {
                    ...blockedArea,
                    south: 40,
                },
            }),
        ).rejects.toThrow();

        expect(queryMock).not.toHaveBeenCalled();
    });

    it('rechaza identificadores inválidos sin consultar la base', async () => {
        await expect(
            listActiveIncidents('identificador-invalido'),
        ).rejects.toThrow();

        expect(queryMock).not.toHaveBeenCalled();
    });

    it('devuelve una lista vacía cuando la consulta no encuentra incidentes', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        await expect(
            listActiveIncidents(simulationId),
        ).resolves.toEqual([]);

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            [simulationId],
        );
    });

    it('propaga un fallo de base para que el endpoint lo controle', async () => {
        queryMock.mockRejectedValueOnce(
            new Error('Base no disponible'),
        );

        await expect(
            listActiveIncidents(simulationId),
        ).rejects.toThrow('Base no disponible');
    });
});