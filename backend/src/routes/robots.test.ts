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

import { robotsRouter } from './robots';

const app = express();

app.use(express.json());
app.use('/api/robots', robotsRouter);

const modelId = '10000000-0000-4000-8000-000000000001';

const payload = {
    name: 'RR-01',
    modelId,
};

const robot = {
    id: '20000000-0000-4000-8000-000000000001',
    ...payload,
    model: 'Demo compacto v1',
    speedKmh: 4,
    batteryCapacityWh: 500,
    consumptionWhPerKm: 40,
    maxSlopePercent: null,
    widthMeters: 0.6,
    lengthMeters: 0.8,
    lateralMarginMeters: 0.15,
    dataSource: 'simulated',
    sourceNotes: 'Datos ficticios para la demo.',
    createdAt: '2026-10-20T00:00:00.000Z',
};

describe('API de robots normalizada', () => {
    beforeEach(() => queryMock.mockReset());

    afterEach(() => vi.restoreAllMocks());

    it('devuelve unidades con las capacidades de su modelo', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [robot],
        });

        const response = await request(app)
            .get('/api/robots');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([robot]);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('JOIN robot_models'),
        );
    });

    it('devuelve una lista vacía', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        const response = await request(app)
            .get('/api/robots');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('registra una unidad solamente con nombre y modelo', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [robot],
        });

        const response = await request(app)
            .post('/api/robots')
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(robot);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining(
                'INSERT INTO robots (name, model_id)',
            ),
            ['RR-01', modelId],
        );
    });

    it.each([
        { name: '' },
        { name: '   ' },
        { name: 'x'.repeat(81) },
        { modelId: null },
        { modelId: 'incorrecto' },
        { modelId: undefined },
        { speedKmh: 999 },
        { widthMeters: 0.01 },
    ])(
        'rechaza datos inválidos o capacidades enviadas por el cliente: %j',
        async (changes) => {
            const response = await request(app)
                .post('/api/robots')
                .send({
                    ...payload,
                    ...changes,
                });

            expect(response.status).toBe(400);
            expect(queryMock).not.toHaveBeenCalled();
        },
    );

    it('informa que el modelo no existe', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        const response = await request(app)
            .post('/api/robots')
            .send(payload);

        expect(response.status).toBe(404);
    });

    it('informa un identificador de unidad duplicado', async () => {
        queryMock.mockRejectedValueOnce({
            code: '23505',
        });

        const response = await request(app)
            .post('/api/robots')
            .send(payload);

        expect(response.status).toBe(409);
    });

    it.each(['get', 'post'] as const)(
        'controla errores internos al hacer %s',
        async (method) => {
            vi.spyOn(console, 'error')
                .mockImplementation(() => {});

            queryMock.mockRejectedValueOnce(
                new Error('Detalle privado'),
            );

            const response = method === 'get'
                ? await request(app)
                    .get('/api/robots')
                : await request(app)
                    .post('/api/robots')
                    .send(payload);

            expect(response.status).toBe(500);

            expect(
                JSON.stringify(response.body),
            ).not.toContain('Detalle privado');
        },
    );
});