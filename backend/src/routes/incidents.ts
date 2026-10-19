import { Router } from 'express';
import { resolvePedestrianSelection } from '../services/pedestrian-network';
import { z } from 'zod';
import {
    createIncident,
    createIncidentSchema,
    listIncidents,
    scenarioTimeSchema,
    simulationIdSchema,
} from '../services/incidents';
import {
    INCIDENT_CATALOG,
    INCIDENT_TYPES,
} from '../config/incident-catalog';
import {
    generateRandomIncident,
    randomIncidentSchema,
    RandomIncidentError,
} from '../services/random-incidents';

export const incidentsRouter = Router();

incidentsRouter.post('/random', async (req, res) => {
    const input =
        randomIncidentSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message:
                'El contexto del reporte aleatorio no es válido.',
        });
        return;
    }

    try {
        const result =
            await generateRandomIncident(input.data);

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof RandomIncidentError) {
            res.status(error.statusCode).json({
                message: error.message,
            });
            return;
        }

        console.error(
            'No se pudo generar el reporte de la flota simulada.',
        );

        res.status(500).json({
            message:
                'No se pudo guardar el reporte de la flota simulada.',
        });
    }
});

incidentsRouter.get('/catalog', (_req, res) => {
    res.status(200).json(
        INCIDENT_TYPES.map((type) => ({
            type,
            ...INCIDENT_CATALOG[type],
        })),
    );
});

const listIncidentsSchema = z.object({
    simulationId: simulationIdSchema,
    scenarioTime: scenarioTimeSchema.optional(),
    includeHistory: z
        .enum(['true', 'false'])
        .optional(),
});

incidentsRouter.post('/', async (req, res) => {
    const input = createIncidentSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message:
                'Revisá la simulación, la ubicación y los datos del incidente.',
        });
        return;
    }

    if (input.data.pedestrianSelection) {
        try { resolvePedestrianSelection(input.data.pedestrianSelection); }
        catch (error) {
            res.status(400).json({ message: error instanceof Error ? error.message : 'La selección no es válida.' });
            return;
        }
    }
    try {
        const incident = await createIncident(input.data);

        res.status(201).json(incident);
    } catch {
        console.error('Error al registrar un incidente.');

        res.status(500).json({
            message: 'No se pudo registrar el incidente.',
        });
    }
});

incidentsRouter.get('/', async (req, res) => {
    const input = listIncidentsSchema.safeParse(req.query);

    if (!input.success) {
        res.status(400).json({
            message:
                'Indicá una simulación, una fecha y opciones de consulta válidas.',
        });
        return;
    }

    try {
        const incidents = await listIncidents(
            input.data.simulationId,
            {
                includeHistory:
                    input.data.includeHistory === 'true',
                ...(input.data.scenarioTime !== undefined
                    ? {
                          scenarioTime: input.data.scenarioTime,
                      }
                    : {}),
            },
        );

        res.status(200).json(incidents);
    } catch {
        console.error('Error al consultar incidentes.');

        res.status(500).json({
            message: 'No se pudieron consultar los incidentes.',
        });
    }
});