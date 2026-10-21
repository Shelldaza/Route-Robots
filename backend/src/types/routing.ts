import type { z } from 'zod';

import type {
    routeRequestSchema,
} from '../schemas/routing';

import type { Coordinate } from '../../../shared/contracts/geography';
export type { Bounds as BlockedArea } from '../../../shared/contracts/geography';

export type RouteRequest = z.infer<typeof routeRequestSchema>;

// Resultado común a los motores de rutas.
//
// GeoJSON utiliza [longitud, latitud].
// Las distancias se expresan en metros y las duraciones en segundos.
//
// Los campos de la red peatonal son opcionales porque una respuesta
// de OpenRouteService no pertenece a nuestra captura local.
export type CalculatedRoute = {
    geometry: {
        type: 'LineString';
        coordinates: Coordinate[];
    };
    distanceMeters: number;
    durationSeconds: number;
    profile: 'foot-walking';
    networkVersion?: string;
    provider?: 'pedestrian-sandbox';
    segmentIds?: string[];
};