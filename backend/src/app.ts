import express from 'express';

import { routesRouter } from './routes/routes';
import { robotsRouter } from './routes/robots';
import { robotModelsRouter } from './routes/robot-models';
import { incidentsRouter } from './routes/incidents';
import { replanningRouter } from './routes/replanning';
import { pedestrianNetworkRouter } from './routes/pedestrian-network';

import {
    surfacesRouter,
    surfaceReplanningRouter,
} from './routes/surfaces';

// Construye la aplicación HTTP sin abrir un puerto.
//
// El arranque del proceso queda en index.ts.
// Las pruebas pueden utilizar esta misma configuración con Supertest.
export function createApp() {
    const app = express();

    // Se conserva el límite de tamaño antes de montar los endpoints.
    // Es importante para los reportes que contienen geometrías.
    app.use(express.json({ limit: '1mb' }));

    app.use('/api/routes', routesRouter);
    app.use('/api/pedestrian-network', pedestrianNetworkRouter);
    app.use('/api/robots', robotsRouter);
    app.use('/api/robot-models', robotModelsRouter);
    app.use('/api/incidents', incidentsRouter);
    app.use('/api/surfaces', surfacesRouter);

    // El orden es parte del comportamiento de la API:
    //
    // 1. Superficies intenta atender el escenario.
    // 2. Si llama next(), continúa el flujo general de replanificación.
    //
    // Invertirlos podría impedir que se evalúe el paso local por superficies.
    app.use(
        '/api/replanning',
        surfaceReplanningRouter,
        replanningRouter,
    );

    // Se conserva la respuesta que ya utiliza el despliegue.
    app.get('/api/health', (_request, response) => {
        response.status(200).json({
            status: 'success',
            message:
                'API de RouteRobots funcionando correctamente con despliegue continuo',
        });
    });

    return app;
}