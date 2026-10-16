import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { calculateRoute } from './routing';

const fetchMock = vi.fn();

const input = {
    origin: {
        lat: 38.9072,
        lng: -77.0369,
    },
    destination: {
        lat: 38.91,
        lng: -77.03,
    },
};

const blockedArea = {
    south: 38.908,
    west: -77.035,
    north: 38.909,
    east: -77.034,
};

const providerResponse = {
    features: [
        {
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.0369, 38.9072],
                    [-77.03, 38.91],
                ],
            },
            properties: {
                summary: {
                    distance: 850,
                    duration: 620,
                },
            },
        },
    ],
};

const detourResponse = {
    features: [
        {
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.0369, 38.9072],
                    [-77.0369, 38.91],
                    [-77.03, 38.91],
                ],
            },
            properties: {
                summary: {
                    distance: 1100,
                    duration: 800,
                },
            },
        },
    ],
};

describe('Servicio de rutas', () => {
    beforeEach(() => {
        fetchMock.mockReset();

        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ORS_API_KEY', 'clave-de-prueba');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('convierte coordenadas y conserva el formato que consume el frontend', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify(providerResponse), {
                status: 200,
            }),
        );

        const route = await calculateRoute(input);

        expect(route).toEqual({
            geometry: providerResponse.features[0]!.geometry,
            distanceMeters: 850,
            durationSeconds: 620,
            profile: 'foot-walking',
        });

        const options = fetchMock.mock.calls[0]![1] as RequestInit;
        const sentBody = JSON.parse(options.body as string);

        expect(sentBody.coordinates).toEqual([
            [-77.0369, 38.9072],
            [-77.03, 38.91],
        ]);

        expect(sentBody).not.toHaveProperty('options');
    });

    it('envía la zona bloqueada como un polígono cerrado y acepta un desvío válido', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify(detourResponse), {
                status: 200,
            }),
        );

        const route = await calculateRoute({
            ...input,
            blockedAreas: [blockedArea],
        });

        expect(route).toEqual({
            geometry: detourResponse.features[0]!.geometry,
            distanceMeters: 1100,
            durationSeconds: 800,
            profile: 'foot-walking',
        });

        const options = fetchMock.mock.calls[0]![1] as RequestInit;
        const sentBody = JSON.parse(options.body as string);

        expect(sentBody.options.avoid_polygons).toEqual({
            type: 'MultiPolygon',
            coordinates: [
                [
                    [
                        [-77.035, 38.908],
                        [-77.034, 38.908],
                        [-77.034, 38.909],
                        [-77.035, 38.909],
                        [-77.035, 38.908],
                    ],
                ],
            ],
        });
    });

    it('rechaza una alternativa que todavía cruza el bloqueo', async () => {
        const crossingResponse = {
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-77.036, 38.9085],
                            [-77.033, 38.9085],
                        ],
                    },
                    properties: {
                        summary: {
                            distance: 300,
                            duration: 200,
                        },
                    },
                },
            ],
        };

        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify(crossingResponse), {
                status: 200,
            }),
        );

        await expect(
            calculateRoute({
                origin: {
                    lat: 38.9085,
                    lng: -77.036,
                },
                destination: {
                    lat: 38.9085,
                    lng: -77.033,
                },
                blockedAreas: [blockedArea],
            }),
        ).rejects.toMatchObject({
            statusCode: 422,
            message:
                'La ruta propuesta atraviesa una zona bloqueada. No se aplicó el desvío.',
        });
    });

    it('rechaza una zona inválida antes de consultar al proveedor', async () => {
        await expect(
            calculateRoute({
                ...input,
                blockedAreas: [
                    {
                        south: 39,
                        north: 38,
                        west: -77.035,
                        east: -77.034,
                    },
                ],
            }),
        ).rejects.toMatchObject({
            statusCode: 400,
        });

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('informa si falta la configuración de la clave', async () => {
        vi.stubEnv('ORS_API_KEY', '');

        await expect(calculateRoute(input)).rejects.toMatchObject({
            statusCode: 503,
        });

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza una respuesta inválida del proveedor', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ unexpected: true }), {
                status: 200,
            }),
        );

        await expect(calculateRoute(input)).rejects.toMatchObject({
            statusCode: 502,
            message: 'El servicio devolvió una respuesta de ruta inesperada.',
        });
    });

    it('controla un tiempo de espera agotado', async () => {
        fetchMock.mockRejectedValueOnce(
            new DOMException('Tiempo agotado', 'TimeoutError'),
        );

        await expect(calculateRoute(input)).rejects.toMatchObject({
            statusCode: 504,
        });
    });

    it('controla errores de conexión sin exponer detalles internos', async () => {
        fetchMock.mockRejectedValueOnce(
            new Error('Detalle interno de conexión'),
        );

        await expect(calculateRoute(input)).rejects.toMatchObject({
            statusCode: 502,
            message: 'No se pudo conectar con el servicio de rutas.',
        });
    });
});