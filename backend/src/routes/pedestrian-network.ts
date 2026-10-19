import { Router } from 'express';
import { z } from 'zod';

import { pedestrianNetwork } from '../services/pedestrian-network';
import { queryPedestrianSegments } from '../services/pedestrian-spatial';

export const pedestrianNetworkRouter = Router();

const boundsSchema = z.object({
    south: z.coerce.number().finite().min(-90).max(90),
    west: z.coerce.number().finite().min(-180).max(180),
    north: z.coerce.number().finite().min(-90).max(90),
    east: z.coerce.number().finite().min(-180).max(180),
}).refine(
    (bounds) =>
        bounds.south < bounds.north &&
        bounds.west < bounds.east,
);

pedestrianNetworkRouter.get('/', (req, res) => {
    const { segments, ...metadata } = pedestrianNetwork;

    const hasBounds = ['south', 'west', 'north', 'east']
        .some((key) => req.query[key] !== undefined);

    if (!hasBounds) {
        res.json({
            ...metadata,
            segmentCount: segments.length,
            segments: [],
        });
        return;
    }

    const parsed = boundsSchema.safeParse(req.query);

    if (!parsed.success) {
        res.status(400).json({
            message: 'Los límites de la zona no son válidos.',
        });
        return;
    }

    const bounds = parsed.data;

    if (
        bounds.north - bounds.south > 0.08 ||
        bounds.east - bounds.west > 0.10
    ) {
        res.status(413).json({
            message: 'Acercá más el mapa para cargar los tramos.',
        });
        return;
    }

    const visible = queryPedestrianSegments(bounds, 12001);

    if (visible.length > 12000) {
        res.status(413).json({
            message:
                'Hay demasiados tramos. Acercá un poco más el mapa.',
        });
        return;
    }

    res.json({
        ...metadata,
        segmentCount: segments.length,
        segments: visible,
    });
});