import request from 'supertest';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

const { calls } = vi.hoisted(() => ({
    calls: [] as string[],
}));

// Se prueba la composición HTTP de app.ts sin consultar cartografía,
// PostgreSQL ni proveedores de IA.
//
// Los tests de cada endpoint conservan la responsabilidad de comprobar
// su lógica real.
vi.mock('./routes/routes', async () => ({
    routesRouter: (await import('express')).Router(),
}));

vi.mock('./routes/robots', async () => ({
    robotsRouter: (await import('express')).Router(),
}));

vi.mock('./routes/robot-models', async () => ({
    robotModelsRouter: (await import('express')).Router(),
}));

vi.mock('./routes/incidents', async () => ({
    incidentsRouter: (await import('express')).Router(),
}));

vi.mock('./routes/pedestrian-network', async () => ({
    pedestrianNetworkRouter:
        (await import('express')).Router(),
}));

vi.mock('./routes/surfaces', async () => {
    const { Router } = await import('express');

    const surfaceReplanningRouter = Router();

    surfaceReplanningRouter.post('/', (req, res, next) => {
        calls.push('surface');

        // Simula un escenario que el flujo de superficies no atiende.
        if (req.body?.mode !== 'surface') {
            next();
            return;
        }

        res.json({
            handledBy: 'surface',
        });
    });

    return {
        surfacesRouter: Router(),
        surfaceReplanningRouter,
    };
});

vi.mock('./routes/replanning', async () => {
    const { Router } = await import('express');

    const replanningRouter = Router();

    replanningRouter.post('/', (_req, res) => {
        calls.push('general');

        res.json({
            handledBy: 'general',
        });
    });

    return {
        replanningRouter,
    };
});

import { createApp } from './app';

describe('Configuración de la aplicación HTTP', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it('conserva la respuesta pública de salud', async () => {
        const response = await request(createApp())
            .get('/api/health');

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: 'success',
            message:
                'API de RouteRobots funcionando correctamente con despliegue continuo',
        });

        expect(calls).toEqual([]);
    });

    it('permite que superficies atienda la evaluación sin ejecutar el flujo general', async () => {
        const response = await request(createApp())
            .post('/api/replanning')
            .send({
                mode: 'surface',
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            handledBy: 'surface',
        });

        // También verifica que express.json haya procesado el cuerpo
        // antes de ejecutar los routers.
        expect(calls).toEqual(['surface']);
    });

    it('continúa con replanificación general cuando superficies llama next', async () => {
        const response = await request(createApp())
            .post('/api/replanning')
            .send({
                mode: 'general',
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            handledBy: 'general',
        });

        expect(calls).toEqual([
            'surface',
            'general',
        ]);
    });

    it('rechaza JSON mayor a 1 MB antes de ejecutar la replanificación', async () => {
        const response = await request(createApp())
            .post('/api/replanning')
            .send({
                mode: 'surface',
                description: 'x'.repeat(1024 * 1024),
            });

        expect(response.status).toBe(413);
        expect(calls).toEqual([]);
    });
});