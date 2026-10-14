import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { routesRouter } from './routes/routes';
import { robotsRouter } from './routes/robots';

const app = express();
const PORT = process.env.PORT || 3000;

// Leer el cuerpo JSON de las peticiones.
app.use(express.json());

// Cálculo de rutas.
app.use('/api/routes', routesRouter);

// Registro y consulta de robots.
app.use('/api/robots', robotsRouter);

// Health check.
app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'API de RouteRobots funcionando correctamente con despliegue continuo',
    });
});

// Arrancar el servidor.
app.listen(PORT, () => {
    console.log(`Servidor de RouteRobots corriendo en http://localhost:${PORT}`);
});