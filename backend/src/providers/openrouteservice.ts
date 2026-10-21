import { z } from 'zod';

import {
    RoutingError,
} from '../services/routing-error';

import {
    routeIntersectsBlockedAreas,
} from '../services/route-geometry';

import type {
    BlockedArea,
    CalculatedRoute,
    RouteRequest,
} from '../types/routing';

// El adaptador conoce el contrato externo de OpenRouteService.
// La selección del motor y la validación de entrada pertenecen al servicio.
const ROUTING_TIMEOUT_MS = 15000;

const coordinateSchema = z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
]);

const geometrySchema = z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordinateSchema).min(2),
});

// La respuesta externa se valida antes de convertirla al resultado
// que utiliza el resto de RouteRobots.
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

function areaToCoordinates(
    area: BlockedArea,
): [number, number][][] {
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

// Recibe una solicitud que ya fue validada por calculateRoute.
// No debe invocarse directamente desde un endpoint con req.body.
export async function requestOpenRouteServiceRoute(
    input: RouteRequest,
): Promise<CalculatedRoute> {
    const apiKey = process.env.ORS_API_KEY?.trim();

    if (!apiKey) {
        throw new RoutingError(
            503,
            'Falta configurar ORS_API_KEY en el backend.',
        );
    }

    const {
        origin,
        destination,
        blockedAreas,
    } = input;

    const hasBlockedAreas =
        (blockedAreas?.length ?? 0) > 0;

    const requestBody = {
        coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
        ],
        instructions: false,

        // Durante un desvío, el origen es la posición del robot sobre
        // una ruta existente. Limitamos el ajuste del origen a un metro.
        ...(hasBlockedAreas
            ? { radiuses: [1, -1] }
            : {}),

        ...(blockedAreas && blockedAreas.length > 0
            ? {
                options: {
                    avoid_polygons: {
                        type: 'MultiPolygon',
                        coordinates:
                            blockedAreas.map(areaToCoordinates),
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
                signal: AbortSignal.timeout(
                    ROUTING_TIMEOUT_MS,
                ),
            },
        );

        if (!response.ok) {
            // El detalle queda en el backend; permite distinguir un rechazo
            // del cálculo de un problema de disponibilidad del proveedor.
            const providerError: unknown = await response
                .json()
                .catch(() => null);

            console.error(
                'OpenRouteService rechazó la solicitud:',
                {
                    status: response.status,
                    elapsedMs: Math.round(
                        performance.now() - startedAt,
                    ),
                    hasBlockedAreas,
                    details: providerError,
                },
            );

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

        const body: unknown = await response
            .json()
            .catch(() => null);

        const parsedResponse =
            providerResponseSchema.safeParse(body);

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

        // Pedir que evite polígonos no garantiza que la respuesta los respete.
        // Comprobamos la geometría antes de aceptar el recorrido.
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
            distanceMeters:
                route.properties.summary.distance,
            durationSeconds:
                route.properties.summary.duration,
            profile: 'foot-walking',
        };
    } catch (error) {
        // Los errores ya clasificados conservan su código y mensaje.
        if (error instanceof RoutingError) {
            throw error;
        }

        const timedOut =
            error instanceof Error
            && error.name === 'TimeoutError';

        // No registramos la clave ni los encabezados.
        // La causa puede identificar problemas de conexión o certificados.
        console.error(
            'Falló la consulta a OpenRouteService:',
            {
                name:
                    error instanceof Error
                        ? error.name
                        : 'UnknownError',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Error desconocido',
                cause:
                    error instanceof Error
                        ? error.cause
                        : undefined,
                elapsedMs: Math.round(
                    performance.now() - startedAt,
                ),
                timeoutMs: ROUTING_TIMEOUT_MS,
                hasBlockedAreas,
            },
        );

        throw new RoutingError(
            timedOut ? 504 : 502,
            timedOut
                ? 'El servicio de rutas tardó demasiado. Reintentá.'
                : 'No se pudo conectar con el servicio de rutas.',
        );
    }
}