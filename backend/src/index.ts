import 'dotenv/config';

import express from 'express';
import type { Request, Response } from 'express';

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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.use('/api/routes', routesRouter);
app.use('/api/pedestrian-network', pedestrianNetworkRouter);
app.use('/api/robots', robotsRouter);
app.use('/api/robot-models', robotModelsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/surfaces', surfacesRouter);

app.use(
    '/api/replanning',
    surfaceReplanningRouter,
    replanningRouter,
);

app.get(
    '/api/health',
    (_request: Request, response: Response) => {
        response.status(200).json({
            status: 'success',
            message:
                'API de RouteRobots funcionando correctamente con despliegue continuo',
        });
    },
);

app.listen(PORT, () => {
    console.log(
        `Servidor de RouteRobots corriendo en http://localhost:${PORT}`,
    );
});