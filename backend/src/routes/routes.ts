import { Router } from 'express';
import { calculateRoute, RoutingError } from '../services/routing';

export const routesRouter = Router();

routesRouter.post('/', async (req, res) => {
    try {
        const route = await calculateRoute(req.body);

        res.status(200).json(route);
    } catch (error) {
        if (error instanceof RoutingError) {
            res.status(error.statusCode).json({
                message: error.message,
            });
            return;
        }

        console.error('Error inesperado al calcular la ruta.');

        res.status(500).json({
            message: 'Ocurrió un error inesperado al calcular la ruta.',
        });
    }
});