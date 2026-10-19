import { z } from 'zod';
import { routeIntersectsBlockedAreas } from './route-geometry';

import { pedestrianNetwork, routeOnPedestrianNetwork } from './pedestrian-network';

const ROUTING_TIMEOUT_MS = 15000;

export const pointSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
});

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
            message:
                'La zona bloqueada debe tener límites ordenados y un área mayor que cero.',
        },
    );

export const routeRequestSchema = z.object({
    origin: pointSchema,
    destination: pointSchema,
    blockedAreas: z.array(blockedAreaSchema).max(10).optional(),
    networkVersion: z.string().optional(),
    blockedSegmentIds: z.array(z.string()).max(300).optional(),
    strictOrigin: z.boolean().optional(),
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
    networkVersion?: string;
    provider?: 'pedestrian-sandbox';
    segmentIds?: string[];
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
    // GeoJSON usa [longitud, latitud] y exige cerrar cada anillo.
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

    if (parsedInput.data.networkVersion) {
        if (parsedInput.data.networkVersion !== pedestrianNetwork.version) {
            throw new RoutingError(409, 'La red peatonal cambió. Recargá el escenario.');
        }
        try {
            return routeOnPedestrianNetwork(parsedInput.data);
        } catch (error) {
            throw new RoutingError(422, error instanceof Error ? error.message : 'No se pudo calcular la ruta peatonal.');
        }
    }
    if (parsedInput.data.blockedSegmentIds?.length) {
        throw new RoutingError(400, 'Los bloqueos de vereda requieren el modo sandbox peatonal.');
    }

    const apiKey = process.env.ORS_API_KEY?.trim();

    if (!apiKey) {
        throw new RoutingError(
            503,
            'Falta configurar ORS_API_KEY en el backend.',
        );
    }

    const { origin, destination, blockedAreas } = parsedInput.data;
    const hasBlockedAreas = (blockedAreas?.length ?? 0) > 0;

    const requestBody = {
        coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
        ],
        instructions: false,
        // Durante un desvío, el origen es la posición del robot sobre
        // una ruta existente. No debe ajustarse a otra calle cercana.
        ...(hasBlockedAreas
            ? { radiuses: [1, -1] }
            : {}),
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

    const startedAt = performance.now();

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
                signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
            },
        );

        if (!response.ok) {
            // El detalle queda en el backend; permite distinguir un rechazo
            // del cálculo de un problema de disponibilidad del proveedor.
            const providerError: unknown = await response
                .json()
                .catch(() => null);

            console.error('OpenRouteService rechazó la solicitud:', {
                status: response.status,
                elapsedMs: Math.round(performance.now() - startedAt),
                hasBlockedAreas,
                details: providerError,
            });

            const message =
                response.status === 401 || response.status === 403
                    ? 'OpenRouteService rechazó la clave o los permisos.'
                    : response.status === 429
                        ? 'Se alcanzó el límite de consultas del servicio de rutas.'
                        : response.status >= 500
                            ? 'El servicio de rutas presentó un error. Reintentá.'
                            : hasBlockedAreas
                                ? 'El servicio no pudo calcular la ruta con las restricciones indicadas.'
                                : 'El servicio no pudo calcular la ruta entre esos puntos. Probá puntos cercanos sobre caminos.';

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

        // Evitar polígonos es una instrucción al proveedor. Comprobamos
        // también la geometría recibida antes de aceptar un desvío.
        if (
            routeIntersectsBlockedAreas(
                route.geometry.coordinates,
                blockedAreas ?? [],
            )
        ) {
            throw new RoutingError(
                422,
                'La ruta propuesta atraviesa una zona bloqueada. No se aplicó el desvío.',
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

        // No registramos la clave ni los encabezados. La causa puede
        // identificar problemas de DNS, conexión o certificados.
        console.error('Falló la consulta a OpenRouteService:', {
            name: error instanceof Error ? error.name : 'UnknownError',
            message:
                error instanceof Error
                    ? error.message
                    : 'Error desconocido',
            cause: error instanceof Error ? error.cause : undefined,
            elapsedMs: Math.round(performance.now() - startedAt),
            timeoutMs: ROUTING_TIMEOUT_MS,
            hasBlockedAreas,
        });

        throw new RoutingError(
            timedOut ? 504 : 502,
            timedOut
                ? 'El servicio de rutas tardó demasiado. Reintentá.'
                : 'No se pudo conectar con el servicio de rutas.',
        );
    }
}