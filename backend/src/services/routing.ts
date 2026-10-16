import { z } from 'zod';

export const pointSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
});

// Rectángulo que representa una zona bloqueada.
export const blockedAreaSchema = z
    .object({
        south: z.number().finite().min(-90).max(90),
        west: z.number().finite().min(-180).max(180),
        north: z.number().finite().min(-90).max(90),
        east: z.number().finite().min(-180).max(180),
    })
    .refine(
        (area) => area.south < area.north && area.west < area.east,
        {
            message: 'La zona bloqueada debe tener límites ordenados y un área mayor que cero.',
        },
    );

export const routeRequestSchema = z.object({
    origin: pointSchema,
    destination: pointSchema,
    blockedAreas: z.array(blockedAreaSchema).max(10).optional(),
});

const coordinateSchema = z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
]);

const geometrySchema = z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordinateSchema).min(2),
});

const providerResponseSchema = z.object({
    features: z.array(
        z.object({
            geometry: geometrySchema,
            properties: z.object({
                summary: z.object({
                    distance: z.number().finite().nonnegative(),
                    duration: z.number().finite().nonnegative(),
                }),
            }),
        }),
    ),
});

export type BlockedArea = z.infer<typeof blockedAreaSchema>;
export type RouteRequest = z.infer<typeof routeRequestSchema>;

export type CalculatedRoute = {
    geometry: z.infer<typeof geometrySchema>;
    distanceMeters: number;
    durationSeconds: number;
    profile: 'foot-walking';
};

export class RoutingError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = 'RoutingError';
    }
}

function areaToCoordinates(area: BlockedArea): [number, number][][] {
    // GeoJSON utiliza [longitud, latitud].
    // La última coordenada cierra el rectángulo.
    return [
        [
            [area.west, area.south],
            [area.east, area.south],
            [area.east, area.north],
            [area.west, area.north],
            [area.west, area.south],
        ],
    ];
}

export async function calculateRoute(
    value: unknown,
): Promise<CalculatedRoute> {
    const parsedInput = routeRequestSchema.safeParse(value);

    if (!parsedInput.success) {
        throw new RoutingError(
            400,
            'Enviá un origen, un destino y zonas bloqueadas con coordenadas válidas.',
        );
    }

    const apiKey = process.env.ORS_API_KEY?.trim();

    if (!apiKey) {
        throw new RoutingError(
            503,
            'Falta configurar ORS_API_KEY en el backend.',
        );
    }

    const { origin, destination, blockedAreas } = parsedInput.data;

    const requestBody = {
        coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
        ],
        instructions: false,
        ...(blockedAreas && blockedAreas.length > 0
            ? {
                  options: {
                      avoid_polygons: {
                          type: 'MultiPolygon',
                          coordinates: blockedAreas.map(areaToCoordinates),
                      },
                  },
              }
            : {}),
    };

    try {
        const response = await fetch(
            'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
            {
                method: 'POST',
                headers: {
                    Authorization: apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(15000),
            },
        );

        if (!response.ok) {
            console.error(
                'Error del servicio de rutas. Estado HTTP:',
                response.status,
            );

            const message =
                response.status === 401 || response.status === 403
                    ? 'OpenRouteService rechazó la clave o los permisos.'
                    : response.status === 429
                      ? 'Se alcanzó el límite de consultas del servicio de rutas.'
                      : 'El servicio no pudo calcular la ruta con las restricciones indicadas.';

            throw new RoutingError(502, message);
        }

        const body: unknown = await response.json().catch(() => null);
        const parsedResponse = providerResponseSchema.safeParse(body);

        if (!parsedResponse.success) {
            throw new RoutingError(
                502,
                'El servicio devolvió una respuesta de ruta inesperada.',
            );
        }

        const route = parsedResponse.data.features[0];

        if (!route) {
            throw new RoutingError(
                422,
                'No se encontró una ruta entre esos puntos.',
            );
        }

        return {
            geometry: route.geometry,
            distanceMeters: route.properties.summary.distance,
            durationSeconds: route.properties.summary.duration,
            profile: 'foot-walking',
        };
    } catch (error) {
        if (error instanceof RoutingError) {
            throw error;
        }

        const timedOut =
            error instanceof Error && error.name === 'TimeoutError';

        throw new RoutingError(
            timedOut ? 504 : 502,
            timedOut
                ? 'El servicio de rutas tardó demasiado. Reintentá.'
                : 'No se pudo conectar con el servicio de rutas.',
        );
    }
}