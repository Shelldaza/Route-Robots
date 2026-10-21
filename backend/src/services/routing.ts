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
//
// Los consumidores actuales pueden seguir importando esquemas, tipos
// y RoutingError desde este servicio.
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

// Este servicio valida la solicitud y elige el motor.
// Los detalles HTTP del proveedor externo quedan en su adaptador.
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

    // Una entrega asociada a una captura usa únicamente esa red.
    //
    // No recurrimos a ORS si el grafo no encuentra un camino: podría proponer
    // conexiones que no pertenecen a la cartografía validada del escenario.
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

    // Un ID de tramo solo tiene sentido dentro de la red que lo define.
    if (input.blockedSegmentIds?.length) {
        throw new RoutingError(
            400,
            'Los bloqueos de vereda requieren el modo sandbox peatonal.',
        );
    }

    return requestOpenRouteServiceRoute(input);
}