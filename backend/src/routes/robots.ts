import { Router } from 'express';

import {
    createRobotSchema,
} from '../schemas/robots';

import {
    listRobots,
    registerRobot,
    RobotRegistrationError,
} from '../services/robots';

export const robotsRouter = Router();

// La ruta administra HTTP. El servicio resuelve el registro y el repositorio
// concentra el acceso a PostgreSQL.
robotsRouter.get('/', async (_req, res) => {
    try {
        res.json(await listRobots());
    } catch (error) {
        console.error(
            'Error al consultar robots:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudieron consultar los robots.',
        });
    }
});

robotsRouter.post('/', async (req, res) => {
    const validation = createRobotSchema.safeParse(req.body);

    if (!validation.success) {
        // Se conserva el formato de errores que ya consume el frontend.
        res.status(400).json({
            message: 'Los datos del robot son inválidos.',
            errors: validation.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });

        return;
    }

    try {
        const robot = await registerRobot(validation.data);

        res.status(201).json(robot);
    } catch (error) {
        if (error instanceof RobotRegistrationError) {
            res.status(
                error.reason === 'model_not_found'
                    ? 404
                    : 409,
            ).json({
                message: error.message,
            });

            return;
        }

        // Los detalles inesperados quedan en el backend,
        // no en la respuesta que recibe el cliente.
        console.error(
            'Error al registrar robot:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudo registrar el robot.',
        });
    }
});