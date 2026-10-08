import { Router } from 'express';
import { z } from 'zod';

export const routesRouter = Router();

// El frontend usa objetos con latitud y longitud.
const pointSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
});

const requestSchema = z.object({
    origin: pointSchema,
    destination: pointSchema,
});

// OpenRouteService devuelve coordenadas GeoJSON:
// [longitud, latitud].
const coordinateSchema = z.tuple([
    z.number().finite(),
    z.number().finite(),
]);

const responseSchema = z.object({
    features: z.array(
        z.object({
            geometry: z.object({
                type: z.literal('LineString'),
                coordinates: z.array(coordinateSchema).min(2),
            }),
            properties: z.object({
                summary: z.object({
                    distance: z.number().finite().nonnegative(),
                    duration: z.number().finite().nonnegative(),
                }),
            }),
        }),
    ),
});

routesRouter.post('/', async (req, res) => {
    const input = requestSchema.safeParse(req.body);

    if (!input.success) {
        res.status(400).json({
            message: 'Enviá un origen y un destino con coordenadas válidas.',
        });
        return;
    }

    const apiKey = process.env.ORS_API_KEY?.trim();

    if (!apiKey) {
        res.status(503).json({
            message: 'Falta configurar ORS_API_KEY en el backend.',
        });
        return;
    }

    const { origin, destination } = input.data;

    try {
        const response = await fetch(
            'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
            {
                method: 'POST',
                headers: {
                    Authorization: apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    coordinates: [
                        [origin.lng, origin.lat],
                        [destination.lng, destination.lat],
                    ],
                    instructions: false,
                }),
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
                      : 'El servicio no pudo calcular la ruta. Probá puntos cercanos sobre caminos.';

            res.status(502).json({ message });
            return;
        }

        const body: unknown = await response.json();
        const parsed = responseSchema.safeParse(body);

        if (!parsed.success) {
            res.status(502).json({
                message: 'El servicio devolvió una respuesta de ruta inesperada.',
            });
            return;
        }

        const route = parsed.data.features[0];

        if (!route) {
            res.status(422).json({
                message: 'No se encontró una ruta entre esos puntos.',
            });
            return;
        }

        res.status(200).json({
            geometry: route.geometry,
            distanceMeters: route.properties.summary.distance,
            durationSeconds: route.properties.summary.duration,
            profile: 'foot-walking',
        });
    } catch (error) {
        const timedOut =
            error instanceof Error && error.name === 'TimeoutError';

        res.status(timedOut ? 504 : 502).json({
            message: timedOut
                ? 'El servicio de rutas tardó demasiado. Reintentá.'
                : 'No se pudo conectar con el servicio de rutas.',
        });
    }
});