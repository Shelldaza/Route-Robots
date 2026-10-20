import express from 'express';
import request from 'supertest';

import {
    afterEach,
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

import { robotModelsRouter } from './robot-models';
import { robotsRouter } from './robots';

const app = express();

app.use(express.json());
app.use('/api/robot-models', robotModelsRouter);
app.use('/api/robots', robotsRouter);

const modelId = '77d9db16-4503-4b17-9077-61165a779fb0';

const payload = {
    name: 'Modelo de prueba',
    speedKmh: 4,
    batteryCapacityWh: 500,
    consumptionWhPerKm: 40,
    maxSlopePercent: null,
    widthMeters: 0.6,
    lengthMeters: 0.8,
    lateralMarginMeters: 0.15,
    dataSource: 'simulated',
    sourceNotes: null,
};

const savedModel = {
    id: modelId,
    ...payload,
    createdAt: '2026-10-19T00:00:00.000Z',
};

describe('Catálogo de modelos y registro por modelo', () => {
    beforeEach(() => queryMock.mockReset());

    afterEach(() => vi.restoreAllMocks());

    it('consulta el catálogo', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedModel],
        });

        const response = await request(app)
            .get('/api/robot-models');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([savedModel]);
    });

    it('guarda dimensiones y procedencia', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedModel],
        });

        const response = await request(app)
            .post('/api/robot-models')
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(savedModel);

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            [
                payload.name,
                4,
                500,
                40,
                null,
                0.6,
                0.8,
                0.15,
                'simulated',
                null,
            ],
        );
    });

    it('conserva medidas desconocidas como null', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedModel],
        });

        const response = await request(app)
            .post('/api/robot-models')
            .send({
                name: 'Sin medidas',
                speedKmh: 4,
                batteryCapacityWh: 500,
                consumptionWhPerKm: 40,
                dataSource: 'unknown',
            });

        expect(response.status).toBe(201);

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            [
                'Sin medidas',
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

    it.each([
        { name: ' ' },
        { widthMeters: 0 },
        { widthMeters: -1 },
        { lengthMeters: '0.8' },
        { lateralMarginMeters: -0.1 },
        { speedKmh: 0 },
        { batteryCapacityWh: -1 },
        { consumptionWhPerKm: 0 },
        { maxSlopePercent: -1 },
        { dataSource: 'inventado' },
        { dataSource: 'documented' },
        { dataSource: 'measured', sourceNotes: ' ' },
        { unknown: true },
    ])('rechaza un modelo inválido: %j', async (changes) => {
        const response = await request(app)
            .post('/api/robot-models')
            .send({
                ...payload,
                ...changes,
            });

        expect(response.status).toBe(400);
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('acepta margen cero explícito y una fuente documentada', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedModel],
        });

        const response = await request(app)
            .post('/api/robot-models')
            .send({
                ...payload,
                lateralMarginMeters: 0,
                dataSource: 'documented',
                sourceNotes: 'Ficha técnica, revisión 1',
            });

        expect(response.status).toBe(201);

        expect(
            queryMock.mock.calls[0]?.[1]?.[7],
        ).toBe(0);
    });

    it('informa nombres de modelos duplicados', async () => {
        queryMock.mockRejectedValueOnce({
            code: '23505',
        });

        const response = await request(app)
            .post('/api/robot-models')
            .send(payload);

        expect(response.status).toBe(409);
    });

    it.each(['get', 'post'] as const)(
        'controla un fallo de base al hacer %s',
        async (method) => {
            vi.spyOn(console, 'error')
                .mockImplementation(() => { });

            queryMock.mockRejectedValueOnce(
                new Error('Detalle privado'),
            );

            const response = method === 'get'
                ? await request(app)
                    .get('/api/robot-models')
                : await request(app)
                    .post('/api/robot-models')
                    .send(payload);

            expect(response.status).toBe(500);

            expect(
                JSON.stringify(response.body),
            ).not.toContain('Detalle privado');
        },
    );

    it('registra una unidad enviando solamente identificador y modelo', async () => {
        const robot = {
            id: 'unidad',
            name: 'RR-02',
            modelId,
            widthMeters: 0.6,
        };

        queryMock.mockResolvedValueOnce({
            rows: [robot],
        });

        const response = await request(app)
            .post('/api/robots')
            .send({
                name: 'RR-02',
                modelId,
            });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(robot);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringMatching(
                /FROM robot_models\s+WHERE id = \$2/,
            ),
            ['RR-02', modelId],
        );
    });

    it('no permite sobrescribir capacidades al elegir un modelo', async () => {
        const response = await request(app)
            .post('/api/robots')
            .send({
                name: 'RR-02',
                modelId,
                speedKmh: 999,
            });

        expect(response.status).toBe(400);
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('rechaza un identificador de modelo inválido', async () => {
        const response = await request(app)
            .post('/api/robots')
            .send({
                name: 'RR-02',
                modelId: 'incorrecto',
            });

        expect(response.status).toBe(400);
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el modelo no existe', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        const response = await request(app)
            .post('/api/robots')
            .send({
                name: 'RR-02',
                modelId,
            });

        expect(response.status).toBe(404);
    });
});