import { z } from 'zod';

// Una unidad selecciona un modelo existente. Sus capacidades no se reciben
// desde el cliente: se obtienen del catálogo almacenado en PostgreSQL.
//
// strictObject rechaza campos adicionales como speedKmh o widthMeters.
export const createRobotSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),
    modelId: z.uuid(),
});

export type CreateRobotInput = z.infer<typeof createRobotSchema>;