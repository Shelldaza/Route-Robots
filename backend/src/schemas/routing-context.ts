import { z } from 'zod';
import { pointSchema } from '../services/routing';

export const routingContextSchema = z.object({
    simulationId: z.string().uuid(),
    origin: pointSchema,
    networkVersion: z.string().optional(),
    destination: pointSchema,
    scenarioTime: z
        .string()
        .datetime({ offset: true })
        .optional(),
});

export type RoutingContext =
    z.infer<typeof routingContextSchema>;