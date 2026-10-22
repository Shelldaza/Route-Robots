import { Router } from 'express';

import {
    createRobotModelSchema,
} from '../schemas/robot-models';

import {
    listRobotModels,
    registerRobotModel,
    RobotModelConflictError,
} from '../services/robot-models';

export const robotModelsRouter = Router();

// La ruta administra HTTP. El servicio coordina el registro
// y el repositorio concentra el acceso a PostgreSQL.
robotModelsRouter.get('/', async (_req, res) => {
    try {
        res.json(await listRobotModels());
    } catch (error) {
        console.error(
            'Error al consultar modelos:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudieron consultar los modelos.',
        });
    }
});

// Cada entrada representa una configuración.
// Para otra configuración se crea otro modelo.
robotModelsRouter.post('/', async (req, res) => {
    const validation = createRobotModelSchema.safeParse(req.body);

    if (!validation.success) {
        // Se conserva el formato de errores utilizado por el frontend.
        res.status(400).json({
            message: 'Los datos del modelo son inválidos.',
            errors: validation.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });

        return;
    }

    try {
        const model = await registerRobotModel(validation.data);

        res.status(201).json(model);
    } catch (error) {
        if (error instanceof RobotModelConflictError) {
            res.status(409).json({
                message: error.message,
            });

            return;
        }

        // El cliente recibe un mensaje general.
        // Los detalles técnicos quedan únicamente en el backend.
        console.error(
            'Error al registrar modelo:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudo registrar el modelo.',
        });
    }
});