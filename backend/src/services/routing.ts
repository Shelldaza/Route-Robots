import {
    routeRequestSchema,
} from '../schemas/routing';

import {
    requestOpenRouteServiceRoute,
} from '../providers/openrouteservice';

import {
    pedestrianNetwork,
    routeOnPedestrianNetwork,
} from './pedestrian-network';

import {
    RoutingError,
} from './routing-error';

import type {
    CalculatedRoute,
} from '../types/routing';

// Compatibilidad con los imports existentes del proyecto.
export {
    pointSchema,
    blockedAreaSchema,
    routeRequestSchema,
} from '../schemas/routing';

export type {
    BlockedArea,
    RouteRequest,
    CalculatedRoute,
} from '../types/routing';

export {
    RoutingError,
} from './routing-error';

/**
 * Valida la solicitud y selecciona el motor de rutas.
 *
 * Este servicio procesa áreas y cierres por tramo.
 * Las superficies deben haber sido procesadas previamente.
 */
export async function calculateRoute(
    value: unknown,
): Promise<CalculatedRoute> {
    const parsedInput =
        routeRequestSchema.safeParse(value);

    if (!parsedInput.success) {
        throw new RoutingError(
            400,
            'Enviá un origen, un destino y zonas bloqueadas con coordenadas válidas.',
        );
    }

    const input = parsedInput.data;

    // Impide ignorar silenciosamente una restricción que este
    // motor no sabe evaluar.
    if (input.surfaceIncidentIds?.length) {
        throw new RoutingError(
            400,
            'Las restricciones de superficie requieren el motor de superficies.',
        );
    }

    // Una entrega asociada a una captura usa únicamente esa red.
    //
    // No recurrimos a ORS si el grafo no encuentra un camino:
    // podría proponer conexiones ajenas al escenario.
    if (input.networkVersion) {
        if (
            input.networkVersion
            !== pedestrianNetwork.version
        ) {
            throw new RoutingError(
                409,
                'La red peatonal cambió. Recargá el escenario.',
            );
        }

        try {
            return routeOnPedestrianNetwork(input);
        } catch (error) {
            throw new RoutingError(
                422,
                error instanceof Error
                    ? error.message
                    : 'No se pudo calcular la ruta peatonal.',
            );
        }
    }

    // Un ID de tramo solo tiene sentido dentro de su red.
    if (input.blockedSegmentIds?.length) {
        throw new RoutingError(
            400,
            'Los bloqueos de vereda requieren el modo sandbox peatonal.',
        );
    }

    return requestOpenRouteServiceRoute(input);
}