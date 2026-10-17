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

const { replanMock } = vi.hoisted(() => ({
    replanMock: vi.fn(),
}));

vi.mock('../agents/replanning', () => {
    class ReplanningError extends Error {
        constructor(
            public readonly statusCode: number,
            message: string,
        ) {
            super(message);
        }
    }

    return {
        replanRoute: replanMock,
        ReplanningError,
    };
});

vi.mock('../services/incidents', () => ({
    listActiveIncidents: vi.fn(),
}));

import {
    ReplanningError,
} from '../agents/replanning';
import {
    replanningRouter,
} from './replanning';

const app = express();

app.use(express.json());
app.use('/api/replanning', replanningRouter);

const input = {
    simulationId: '21bd592c-0da1-43d4-9307-8494429bd15b',
    origin: {
        lat: 38.9072,
        lng: -77.0369,
    },
    destination: {
        lat: 38.91,
        lng: -77.03,
    },
};

describe('API de replanificación', () => {
    beforeEach(() => {
        replanMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rechaza datos inválidos antes de ejecutar el agente', async () => {
        const response = await request(app)
            .post('/api/replanning')
            .send({
                ...input,
                simulationId: 'invalido',
            });

        expect(response.status).toBe(400);
        expect(replanMock).not.toHaveBeenCalled();
    });

    it('devuelve el resultado del agente', async () => {
        const result = {
            status: 'alternative_ready',
            route: {
                distanceMeters: 1100,
            },
            explanation: 'Se calculó un desvío.',
            incidentIds: [],
            toolCalls: [],
        };

        replanMock.mockResolvedValueOnce(result);

        const response = await request(app)
            .post('/api/replanning')
            .send(input);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(result);

        expect(replanMock).toHaveBeenCalledWith(
            input,
            expect.objectContaining({
                calculateRoute: expect.any(Function),
                listActiveIncidents: expect.any(Function),
            }),
        );
    });

    it('informa cuando no hay bloqueos activos', async () => {
        replanMock.mockRejectedValueOnce(
            new ReplanningError(
                409,
                'La simulación no tiene bloqueos activos.',
            ),
        );

        const response = await request(app)
            .post('/api/replanning')
            .send(input);

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(
            'La simulación no tiene bloqueos activos.',
        );
    });

    it('no expone detalles de errores inesperados', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        replanMock.mockRejectedValueOnce(
            new Error('Detalle interno privado'),
        );

        const response = await request(app)
            .post('/api/replanning')
            .send(input);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            message: 'No se pudo completar la replanificación.',
        });
    });
});