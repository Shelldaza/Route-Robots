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

const validPayload = {
    name: 'RR-01',
    model: 'Perfil de prueba',
    speedKmh: 4,
    batteryCapacityWh: 500,
    consumptionWhPerKm: 40,
    maxSlopePercent: 8,
};

const savedRobot = {
    id: 'ddd96b67-21fb-4274-8782-90ef13712a3a',
    ...validPayload,
    createdAt: '2026-10-14T16:51:21.163Z',
};

describe('API de robots', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('devuelve los robots registrados', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedRobot],
        });

        const response = await request(app)
            .get('/api/robots');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([savedRobot]);
    });

    it('devuelve una lista vacía cuando no hay robots', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [],
        });

        const response = await request(app)
            .get('/api/robots');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('registra un robot válido', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [savedRobot],
        });

        const response = await request(app)
            .post('/api/robots')
            .send(validPayload);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(savedRobot);

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            ['RR-01', 'Perfil de prueba', 4, 500, 40, 8],
        );
    });

    it('envía null a la base cuando se omiten los campos opcionales', async () => {
        const robot = {
            ...savedRobot,
            model: null,
            maxSlopePercent: null,
        };

        queryMock.mockResolvedValueOnce({
            rows: [robot],
        });

        const response = await request(app)
            .post('/api/robots')
            .send({
                name: 'RR-01',
                speedKmh: 4,
                batteryCapacityWh: 500,
                consumptionWhPerKm: 40,
            });

        expect(response.status).toBe(201);
        expect(response.body.model).toBeNull();
        expect(response.body.maxSlopePercent).toBeNull();

        expect(queryMock).toHaveBeenCalledWith(
            expect.any(String),
            ['RR-01', null, 4, 500, 40, null],
        );
    });

    it.each([
        ['nombre vacío', { name: '   ' }],
        ['velocidad negativa', { speedKmh: -1 }],
        ['velocidad cero', { speedKmh: 0 }],
        ['batería cero', { batteryCapacityWh: 0 }],
        ['consumo negativo', { consumptionWhPerKm: -1 }],
        ['pendiente negativa', { maxSlopePercent: -1 }],
        ['velocidad como texto', { speedKmh: '4' }],
    ])('rechaza %s sin consultar la base', async (_name, changes) => {
        const response = await request(app)
            .post('/api/robots')
            .send({
                ...validPayload,
                ...changes,
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            'Los datos del robot son inválidos.',
        );
        expect(response.body.errors).toEqual(
            expect.any(Array),
        );
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('devuelve 409 cuando el nombre está duplicado', async () => {
        queryMock.mockRejectedValueOnce({
            code: '23505',
            constraint: 'robots_name_unique',
        });

        const response = await request(app)
            .post('/api/robots')
            .send(validPayload);

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(
            'Ya existe un robot con ese nombre o identificador.',
        );
    });

    it('controla un fallo al consultar sin exponer detalles internos', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        queryMock.mockRejectedValueOnce(
            new Error('Detalle interno de conexión'),
        );

        const response = await request(app)
            .get('/api/robots');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            message: 'No se pudieron consultar los robots.',
        });
    });

    it('controla un fallo al registrar sin exponer detalles internos', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        queryMock.mockRejectedValueOnce(
            new Error('Detalle interno de conexión'),
        );

        const response = await request(app)
            .post('/api/robots')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            message: 'No se pudo registrar el robot.',
        });
    });
});