import 'dotenv/config';
import express, { Request, Response } from 'express';
import { routesRouter } from './routes/routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Leer el cuerpo JSON de las peticiones.
app.use(express.json());

// Registrar el endpoint POST /api/routes.
app.use('/api/routes', routesRouter);

// Health check.
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'API de RouteRobots funcionando correctamente con despliegue continuo',
    });
});

// Arrancar el servidor.
app.listen(PORT, () => {
    console.log(`Servidor de RouteRobots corriendo en http://localhost:${PORT}`);
});