import {
    RoutingError,
} from './routing-error';

import {
    routeIntersectsBlockedAreas,
} from './route-geometry';

import {
    routeRequestSchema,
} from '../schemas/routing';

import type {
    RoutingContext,
} from '../schemas/routing-context';

import type {
    CalculatedRoute,
    RouteRequest,
} from '../types/routing';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import type {
    RoutingIncident,
    RoutingIncidentInput,
    RoutingRestriction,
} from '../types/routing-restrictions';

/**
 * Convierte los registros del backend en restricciones explícitas.
 *
 * Solo los bloqueos afectan este cálculo. Una precaución o un aviso
 * siguen siendo incidentes visibles, pero no cierran el paso.
 */
export function toRoutingIncidents(
    incidents: RoutingIncidentInput[],
    networkVersion?: string,
): RoutingIncident[] {
    return incidents
        .filter((incident) =>
            incident.effect === 'blockage'
        )
        .map((incident) => {
            if ('restriction' in incident) {
                if (
                    incident.restriction.kind === 'segments'
                    && !incident.restriction.segmentIds.length
                ) {
                    throw new RoutingError(
                        400,
                        'Una restricción por tramo debe identificar los tramos afectados.',
                    );
                }

                return incident;
            }

            let restriction: RoutingRestriction;

            // Una superficie puede conservar IDs de tramos cercanos.
            // Esos IDs no significan que los tramos estén cerrados
            // completamente: prevalece su geometría de superficie.
            if (incident.surfaceImpact) {
                if (!networkVersion) {
                    throw new RoutingError(
                        400,
                        'Las restricciones de superficie requieren una red peatonal.',
                    );
                }

                restriction = {
                    kind: 'surface',
                    networkVersion,
                };
            } else if (incident.pedestrianImpact) {
                if (
                    !incident.pedestrianImpact.segmentIds.length
                ) {
                    throw new RoutingError(
                        400,
                        'Una restricción por tramo debe identificar los tramos afectados.',
                    );
                }

                restriction = {
                    kind: 'segments',
                    networkVersion:
                        incident.pedestrianImpact.networkVersion,
                    segmentIds: [
                        ...new Set(
                            incident.pedestrianImpact.segmentIds,
                        ),
                    ],
                };
            } else {
                restriction = {
                    kind: 'area',
                    bounds: incident.blockedArea,
                };
            }

            // Elegimos los metadatos explícitamente.
            // Las geometrías de superficie permanecen en el backend.
            return {
                id: incident.id,
                simulationId: incident.simulationId,
                type: incident.type,
                source: incident.source,
                description: incident.description,
                effect: incident.effect,
                reporterName: incident.reporterName,
                createdAt: incident.createdAt,
                startsAt: incident.startsAt,
                expiresAt: incident.expiresAt,
                restriction,
            };
        });
}

/**
 * Conserva el nombre utilizado por el endpoint de superficies.
 *
 * Ya no fabrica un pedestrianImpact con listas vacías.
 */
export function toolIncidents(
    incidents: SurfaceIncident[],
    context: SurfaceContext,
) {
    return toRoutingIncidents(
        incidents,
        context.networkVersion,
    );
}

/**
 * Traduce cada alcance al dato que debe consumir su motor.
 *
 * - Áreas: rectángulos bloqueados.
 * - Tramos: identificadores del grafo.
 * - Superficies: referencias que resolverá el motor geométrico.
 */
export function buildRestrictedRouteRequest(
    context: RoutingContext,
    incidents: RoutingIncident[],
): RouteRequest {
    const surfaceIncidentIds: string[] = [];

    const blockedSegmentIds = new Set<string>();

    const blockedAreas: RouteRequest['blockedAreas'] = [];

    for (const incident of incidents) {
        const restriction = incident.restriction;

        if (restriction.kind === 'area') {
            blockedAreas.push(restriction.bounds);
            continue;
        }

        if (!context.networkVersion) {
            throw new RoutingError(
                400,
                'Los bloqueos de vereda requieren una entrega en el sandbox peatonal.',
            );
        }

        if (
            restriction.networkVersion
            !== context.networkVersion
        ) {
            throw new RoutingError(
                409,
                'Hay incidentes de otra versión de red. Iniciá un escenario nuevo.',
            );
        }

        if (restriction.kind === 'surface') {
            surfaceIncidentIds.push(incident.id);
        } else {
            if (!restriction.segmentIds.length) {
                throw new RoutingError(
                    400,
                    'Una restricción por tramo debe identificar los tramos afectados.',
                );
            }

            for (const id of restriction.segmentIds) {
                blockedSegmentIds.add(id);
            }
        }
    }

    return {
        origin: context.origin,
        destination: context.destination,
        blockedAreas,

        ...(context.networkVersion
            ? {
                networkVersion: context.networkVersion,
                strictOrigin: true,
                blockedSegmentIds: [
                    ...blockedSegmentIds,
                ],
            }
            : {}),

        ...(surfaceIncidentIds.length
            ? {
                surfaceIncidentIds: [
                    ...new Set(surfaceIncidentIds),
                ],
            }
            : {}),
    };
}

/**
 * El motor de superficies consume sus referencias antes de llamar
 * al grafo.
 *
 * Primero comprueba que correspondan a los bloqueos de superficie
 * que acaba de leer el backend. Después elimina esas referencias
 * de la solicitud destinada a los motores inferiores.
 */
export function consumeSurfaceRestrictions(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
): unknown {
    if (
        !value
        || typeof value !== 'object'
        || !('surfaceIncidentIds' in value)
    ) {
        return value;
    }

    const parsed = routeRequestSchema.safeParse(value);

    if (!parsed.success) {
        throw new RoutingError(
            400,
            'La solicitud de restricciones de superficie no es válida.',
        );
    }

    const {
        surfaceIncidentIds,
        ...request
    } = parsed.data;

    const expected = incidents
        .filter((incident) =>
            incident.effect === 'blockage'
            && incident.surfaceImpact
        )
        .map((incident) => incident.id)
        .sort();

    const received = [
        ...new Set(surfaceIncidentIds ?? []),
    ].sort();

    if (
        request.networkVersion !== context.networkVersion
        || JSON.stringify(expected)
            !== JSON.stringify(received)
    ) {
        throw new RoutingError(
            409,
            'Los incidentes de superficie cambiaron durante la evaluación. Solicitá nuevamente el desvío.',
        );
    }

    return request;
}

/**
 * Comprobaciones finales del backend.
 *
 * No dependen de lo que afirme la explicación de la IA.
 * La geometría de superficie se comprueba en su propio motor.
 */
export function validateRestrictedRoute(
    route: CalculatedRoute,
    incidents: RoutingIncident[],
    context: RoutingContext,
) {
    const pedestrian = incidents.filter((incident) =>
        incident.restriction.kind !== 'area'
    );

    if (pedestrian.length) {
        if (
            !context.networkVersion
            || route.provider !== 'pedestrian-sandbox'
            || route.networkVersion !== context.networkVersion
            || pedestrian.some((incident) =>
                incident.restriction.kind !== 'area'
                && incident.restriction.networkVersion
                    !== context.networkVersion
            )
        ) {
            throw new RoutingError(
                409,
                'No se pudo validar la alternativa sobre la misma red peatonal. Solicitá nuevamente el desvío.',
            );
        }

        const blocked = new Set(
            pedestrian.flatMap((incident) =>
                incident.restriction.kind === 'segments'
                    ? incident.restriction.segmentIds
                    : []
            ),
        );

        if (
            blocked.size
            && !Array.isArray(route.segmentIds)
        ) {
            throw new RoutingError(
                409,
                'No se pudieron verificar los tramos recorridos frente a los bloqueos peatonales.',
            );
        }

        if (
            (route.segmentIds ?? []).some((id) =>
                blocked.has(id)
            )
        ) {
            throw new RoutingError(
                422,
                'La alternativa atraviesa un tramo peatonal bloqueado.',
            );
        }
    }

    // Solo las restricciones de tipo area utilizan estos límites.
    // Nunca convertimos aquí una superficie o un tramo en rectángulo.
    const areas = incidents.flatMap((incident) =>
        incident.restriction.kind === 'area'
            ? [incident.restriction.bounds]
            : []
    );

    if (
        routeIntersectsBlockedAreas(
            route.geometry.coordinates,
            areas,
        )
    ) {
        throw new RoutingError(
            422,
            'La alternativa no evita todos los bloqueos activos.',
        );
    }
}