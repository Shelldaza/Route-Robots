import { Router } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import {
    replanRoute,
    ReplanningError,
} from '../agents/replanning';
import {
    calculateRoute,
    pointSchema,
} from '../services/routing';
import {
    listActiveIncidents,
} from '../services/incidents';

export const replanningRouter = Router();

const requestSchema = z.object({
    simulationId: z.string().uuid(),
    origin: pointSchema,
    destination: pointSchema,
});

replanningRouter.post('/', async (req, res) => {
    const input = requestSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message:
                'Enviá una simulación, un origen y un destino válidos.',
        });
        return;
    }

    try {
        const result = await replanRoute(input.data, {
            calculateRoute,
            listActiveIncidents,
        });

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof ReplanningError) {
            res.status(error.statusCode).json({
                message: error.message,
            });
            return;
        }

        if (error instanceof OpenAI.APIError) {
            console.error(
                'Error de OpenAI durante la replanificación:',
                error.status,
                error.code,
            );

            res.status(502).json({
                message:
                    'El servicio de IA no pudo completar la evaluación. Revisá su disponibilidad, acceso al modelo o saldo.',
            });
            return;
        }

        console.error('Error inesperado durante la replanificación.');

        res.status(500).json({
            message: 'No se pudo completar la replanificación.',
        });
    }
});