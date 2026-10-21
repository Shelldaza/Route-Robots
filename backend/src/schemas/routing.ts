import { z } from 'zod';

// Coordenadas recibidas por la API en formato { lat, lng }.
export const pointSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
});

// Un rectángulo necesita límites geográficos válidos y ordenados.
export const blockedAreaSchema = z
    .object({
        south: z.number().finite().min(-90).max(90),
        west: z.number().finite().min(-180).max(180),
        north: z.number().finite().min(-90).max(90),
        east: z.number().finite().min(-180).max(180),
    })
    .refine(
        (area) =>
            area.south < area.north
            && area.west < area.east,
        {
            message:
                'La zona bloqueada debe tener límites ordenados y un área mayor que cero.',
        },
    );

// Conservamos el contrato actual de solicitudes.
//
// networkVersion selecciona la captura peatonal local.
// blockedSegmentIds identifica cierres dentro de esa captura.
// strictOrigin impide ajustes amplios de la posición del robot.
export const routeRequestSchema = z.object({
    origin: pointSchema,
    destination: pointSchema,
    blockedAreas: z.array(blockedAreaSchema).max(10).optional(),
    networkVersion: z.string().optional(),
    blockedSegmentIds: z.array(z.string()).max(300).optional(),
    strictOrigin: z.boolean().optional(),
});