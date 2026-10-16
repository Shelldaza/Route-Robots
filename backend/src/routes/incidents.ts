import { Router } from 'express';
import {
    createIncident,
    createIncidentSchema,
    listActiveIncidents,
    simulationIdSchema,
} from '../services/incidents';

export const incidentsRouter = Router();

incidentsRouter.post('/', async (req, res) => {
    const input = createIncidentSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message: 'Enviá una simulación y una zona bloqueada válidas.',
        });
        return;
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
    const input = simulationIdSchema.safeParse(req.query.simulationId);

    if (!input.success) {
        res.status(400).json({
            message: 'Indicá un identificador de simulación válido.',
        });
        return;
    }

    try {
        const incidents = await listActiveIncidents(input.data);

        res.status(200).json(incidents);
    } catch {
        console.error('Error al consultar incidentes.');

        res.status(500).json({
            message: 'No se pudieron consultar los incidentes.',
        });
    }
});