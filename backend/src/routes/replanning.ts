import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import {
    replanRoute,
    ReplanningError,
} from '../agents/replanning';
import {
    routingContextSchema,
} from '../schemas/routing-context';
import {
    calculateRoute,
} from '../services/routing';
import {
    listActiveIncidents,
} from '../services/incidents';

export const replanningRouter = Router();

replanningRouter.post('/', async (req, res) => {
    const input =
        routingContextSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message:
                'Enviá una simulación, un origen, un destino y una fecha de escenario válidos.',
        });
        return;
    }

    try {
        const result = await replanRoute(
            input.data,
            {
                calculateRoute,
                listActiveIncidents,
            },
        );

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof ReplanningError) {
            res.status(error.statusCode).json({
                message: error.message,
            });
            return;
        }

        if (error instanceof Anthropic.APIError) {
            console.error(
                'Error de Claude durante la replanificación:',
                error.status,
            );

            res.status(502).json({
                message:
                    'El servicio de IA no pudo completar la evaluación. Revisá su disponibilidad, acceso al modelo o saldo.',
            });
            return;
        }

        console.error(
            'Error inesperado durante la replanificación.',
        );

        res.status(500).json({
            message:
                'No se pudo completar la replanificación.',
        });
    }
});