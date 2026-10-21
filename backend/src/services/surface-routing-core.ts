import {
    calculateRoute,
    RoutingError,
} from './routing';
import { gzipSync } from 'node:zlib';
import type {
    CalculatedRoute,
    BlockedArea,
} from './routing';

import { queryPedestrianSegments } from './pedestrian-spatial';
import { distanceMeters } from './pedestrian-network';
import { robotRadius } from './surface-incidents';

import type {
    SurfaceContext,
    SurfaceIncident,
} from './surface-incidents';

import {
    adaptLine,
    booleanArea,
    connectOnSurface,
    makeConstraint,
    SurfaceGeometryError,
    unionAreas,
} from './surface-geometry';

import {
    areaBounds,
    boxArea,
    contains,
    lineHits,
    local,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
    SurfaceImpact,
    WalkSurface,
} from '../../../shared/surfaces';

import { routeIntersectsBlockedAreas } from './route-geometry';

function boundsArea(bounds: BlockedArea): Area {
    return {
        type: 'MultiPolygon',
        coordinates: [[[
            [bounds.west, bounds.south],
            [bounds.east, bounds.south],
            [bounds.east, bounds.north],
            [bounds.west, bounds.north],
            [bounds.west, bounds.south],
        ]]],
    };
}

export function legacyObstacles(
    surfaces: WalkSurface[],
    incidents: SurfaceIncident[],
): Area {
    const areas: Area[] = [];

    for (const incident of incidents) {
        if (
            incident.surfaceImpact
            || incident.effect !== 'blockage'
        ) {
            continue;
        }

        if (!incident.pedestrianImpact) {
            areas.push(boundsArea(incident.blockedArea));
            continue;
        }

        for (const segment of incident.pedestrianImpact.segments) {
            for (
                let index = 1;
                index < segment.coordinates.length;
                index++
            ) {
                const a = segment.coordinates[index - 1]!;
                const b = segment.coordinates[index]!;

                const delta = local(b, a);
                const length = Math.hypot(delta[0], delta[1]);

                if (length < 0.001) continue;

                for (const surface of surfaces) {
                    if (!lineHits([a, b], surface.geometry)) {
                        continue;
                    }

                    const extent = Math.max(
                        ...surface.geometry.coordinates
                            .flat(2)
                            .map((point) => {
                                const projected = local(point, a);

                                return Math.hypot(
                                    projected[0],
                                    projected[1],
                                );
                            }),
                    ) + 1;

                    // Cierra una sección transversal limitada por
                    // los extremos del tramo, no todo el polígono.
                    const strip = boxArea({
                        center: world([
                            delta[0] / 2,
                            delta[1] / 2,
                        ], a),
                        halfWidth: length / 2 + 0.002,
                        halfLength: extent,
                        angle: Math.atan2(delta[1], delta[0]),
                    });

                    const clipped = booleanArea(
                        surface.geometry,
                        strip,
                        'intersection',
                    );

                    for (const polygon of clipped.coordinates) {
                        const part: Area = {
                            type: 'MultiPolygon',
                            coordinates: [polygon],
                        };

                        // Conserva únicamente la parte que corresponde
                        // a la línea seleccionada, evitando otra vereda.
                        if (lineHits([a, b], part)) {
                            areas.push(part);
                        }
                    }
                }
            }
        }
    }

    return unionAreas(areas);
}

export function surfaceConstraints(
    impacts: SurfaceImpact[],
    radius: number,
    knownSurfaces: WalkSurface[] = [],
    general: SurfaceIncident[] = [],
) {
    if (
        new Set(impacts.map((impact) => impact.source)).size > 1
    ) {
        throw new RoutingError(
            409,
            'Hay reportes de fuentes cartográficas distintas. Iniciá una simulación nueva.',
        );
    }

    const surfaces = new Map<number, WalkSurface>();

    function add(surface: WalkSurface) {
        if (![1480, 1483].includes(surface.code)) return;

        const previous = surfaces.get(surface.id);

        if (
            previous
            && JSON.stringify(previous.geometry)
            !== JSON.stringify(surface.geometry)
        ) {
            throw new RoutingError(
                409,
                'La cartografía de este escenario cambió. Iniciá uno nuevo.',
            );
        }

        surfaces.set(surface.id, surface);
    }

    for (const surface of knownSurfaces) {
        add(surface);
    }

    for (const impact of impacts) {
        for (
            const surface
            of impact.contextSurfaces ?? impact.surfaces
        ) {
            add(surface);
        }
    }

    const values = [...surfaces.values()];

    if (!values.length) return [];

    const source = unionAreas(
        values.map((surface) => surface.geometry),
    );

    const legacy = legacyObstacles(values, general);

    const obstacles = unionAreas([
        ...impacts.map((impact) => impact.geometry),
        legacy,
    ]);

    return [{
        constraint: makeConstraint(
            source,
            obstacles,
            radius,
        ),
    }];
}

export function previewSurfacePath(
    coordinates: Point[],
    impacts: SurfaceImpact[],
    radius: number,
    general: SurfaceIncident[] = [],
) {
    const constraints = surfaceConstraints(
        impacts,
        radius,
        [],
        general,
    );

    const free = unionAreas(
        constraints.map((item) => item.constraint.free),
    );

    const danger = unionAreas(
        constraints.map((item) => item.constraint.danger),
    );

    if (
        coordinates.length < 2
        || !lineHits(coordinates, danger)
    ) {
        return {
            state: 'off_route' as const,
            message:
                'El área seleccionada no alcanza el recorrido pendiente.',
            coordinates,
            free,
        };
    }

    try {
        let adapted = coordinates;

        for (const item of constraints) {
            adapted = adaptLine(adapted, item.constraint);
        }

        if (lineHits(adapted, danger)) {
            throw new SurfaceGeometryError(
                'unknown',
                'La alternativa todavía alcanza un obstáculo.',
            );
        }

        return {
            state: 'local_path' as const,
            message:
                'Hay una alternativa local cartográfica que respeta el ancho y los márgenes.',
            coordinates: adapted,
            free,
        };
    } catch (error) {
        if (!(error instanceof SurfaceGeometryError)) {
            throw error;
        }

        return {
            state: error.state,
            message: error.message,
            coordinates: [] as Point[],
            free,
        };
    }
}
export async function calculateSurfaceRoute(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
    knownSurfaces: WalkSurface[] = [],
    preferredCoordinates?: Point[],
): Promise<CalculatedRoute> {
    const active = incidents.filter((incident) =>
        incident.effect === 'blockage'
    );

    if (
        preferredCoordinates
        && preferredCoordinates.length >= 2
    ) {
        const input = value as {
            origin: {
                lng: number;
                lat: number;
            };
            destination: {
                lng: number;
                lat: number;
            };
            networkVersion?: string;
            blockedAreas?: BlockedArea[];
            blockedSegmentIds?: string[];
        };

        const origin: Point = [
            input.origin.lng,
            input.origin.lat,
        ];

        const destination: Point = [
            input.destination.lng,
            input.destination.lat,
        ];

        const legacy = active.filter((incident) =>
            !incident.surfaceImpact
        );

        const legacyIds = new Set(
            legacy.flatMap((incident) =>
                incident.pedestrianImpact?.segmentIds ?? []
            ),
        );

        // Las restricciones adicionales del grafo deben
        // resolverse con el motor que conoce sus aristas.
        const hasAdditionalBlocks = (
            input.blockedSegmentIds ?? []
        ).some((id) => !legacyIds.has(id));

        const endpointsMatch =
            distanceMeters(
                preferredCoordinates[0]!,
                origin,
            ) <= 0.02
            && distanceMeters(
                preferredCoordinates.at(-1)!,
                destination,
            ) <= 0.02;

        if (
            input.networkVersion === context.networkVersion
            && endpointsMatch
            && !hasAdditionalBlocks
            && legacyIds.size === 0
        ) {
            const impacts = active.flatMap((incident) =>
                incident.surfaceImpact
                    ? [incident.surfaceImpact]
                    : []
            );

            const constraints = surfaceConstraints(
                impacts,
                robotRadius(context),
                knownSurfaces,
                active,
            );

            if (constraints.length) {
                try {
                    let coordinates =
                        preferredCoordinates.map(
                            (point): Point => [
                                point[0],
                                point[1],
                            ],
                        );

                    // Primero intentamos adaptar el recorrido
                    // pendiente, igual que en la vista previa.
                    for (const item of constraints) {
                        coordinates = adaptLine(
                            coordinates,
                            item.constraint,
                        );
                    }

                    // Los reportes por tramo conservan sus
                    // restricciones. Si la maniobra alcanza
                    // sus límites, recurrimos al grafo.
                    const blockedAreas = [
                        ...(input.blockedAreas ?? []),
                        ...legacy.map((incident) =>
                            incident.blockedArea
                        ),
                    ];

                    if (
                        distanceMeters(
                            coordinates[0]!,
                            origin,
                        ) > 0.02
                        || distanceMeters(
                            coordinates.at(-1)!,
                            destination,
                        ) > 0.02
                        || constraints.some((item) =>
                            lineHits(
                                coordinates,
                                item.constraint.danger,
                            )
                        )
                        || routeIntersectsBlockedAreas(
                            coordinates,
                            blockedAreas,
                        )
                    ) {
                        throw new SurfaceGeometryError(
                            'unknown',
                            'La adaptación del recorrido pendiente no supera la validación final.',
                        );
                    }

                    let distance = 0;

                    for (
                        let index = 1;
                        index < coordinates.length;
                        index++
                    ) {
                        distance += distanceMeters(
                            coordinates[index - 1]!,
                            coordinates[index]!,
                        );
                    }

                    console.info(
                        '[Superficies: recorrido pendiente adaptado]',
                        JSON.stringify({
                            simulationId: context.simulationId,
                            activeBlockages: active.length,
                            distanceMeters: distance,
                        }),
                    );

                    return {
                        geometry: {
                            type: 'LineString',
                            coordinates,
                        },
                        distanceMeters: distance,
                        durationSeconds:
                            distance / (5 / 3.6),
                        profile: 'foot-walking',
                        networkVersion: context.networkVersion,
                        provider: 'pedestrian-sandbox',
                    };
                } catch (error) {
                    if (
                        !(error instanceof SurfaceGeometryError)
                    ) {
                        throw error;
                    }

                    console.warn(
                        '[Superficies: recorrido pendiente descartado]',
                        JSON.stringify({
                            simulationId: context.simulationId,
                            state: error.state,
                            reason: error.message,
                        }),
                    );
                }
            }
        }
    }

    // Si no se pudo verificar la adaptación local,
    // buscamos otra ruta mediante el cálculo existente.
    return calculateFallbackSurfaceRoute(
        value,
        context,
        active,
        knownSurfaces,
    );
}

async function calculateFallbackSurfaceRoute(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
    knownSurfaces: WalkSurface[] = [],
): Promise<CalculatedRoute> {
    const input = value as Record<string, unknown>;

    const impacts = incidents.flatMap((incident) =>
        incident.surfaceImpact ? [incident.surfaceImpact] : []
    );

    if (!impacts.length && !knownSurfaces.length) {
        return calculateRoute(value);
    }

    const start = input.origin as {
        lng: number;
        lat: number;
    };

    const finish = input.destination as {
        lng: number;
        lat: number;
    };

    const origin: Point = [start.lng, start.lat];

    const nearby = knownSurfaces.filter((surface) =>
        contains(surface.geometry, origin)
    ).slice(0, 8);

    const constraints = surfaceConstraints(
        impacts,
        robotRadius(context),
        nearby,
        incidents,
    );

    if (
        constraints.some((item) =>
            contains(item.constraint.danger, origin)
        )
    ) {
        throw new RoutingError(
            422,
            'El área de un incidente alcanza la posición actual del robot, incluido su margen. No se puede iniciar un rodeo desde dentro de esa zona.',
        );
    }

    if (
        constraints.some((item) =>
            contains(
                item.constraint.danger,
                [finish.lng, finish.lat],
            )
        )
    ) {
        throw new RoutingError(
            422,
            'El área de un incidente alcanza el destino, incluido el margen del robot. Ese punto no es accesible mientras el incidente siga activo.',
        );
    }

    const blocked = new Set(
        (
            Array.isArray(input.blockedSegmentIds)
                ? input.blockedSegmentIds
                : []
        ) as string[],
    );

    let localFailure: SurfaceGeometryError | null = null;

    function unavailable() {
        console.warn(
            '[Superficies: diagnóstico]',
            JSON.stringify({
                simulationId: context.simulationId,
                origin: input.origin,
                destination: input.destination,
                widthMeters: context.widthMeters,
                lateralMarginMeters: context.lateralMarginMeters,
                reason:
                    localFailure?.message
                    ?? 'No se pudo conectar con el grafo',
                state: localFailure?.state ?? 'unknown',
                activeIncidents: incidents.map((incident) => ({
                    id: incident.id,
                    mode: incident.surfaceImpact
                        ? 'surface'
                        : 'legacy',
                    effect: incident.effect,
                })),
                blockedSegmentCount: blocked.size,
            }),
        );

        return new RoutingError(
            422,
            localFailure?.state === 'blocked'
                ? 'El espacio libre quedó bloqueado para este robot y no se encontró otra ruta en la red evaluada.'
                : 'No se pudo verificar el paso local ni encontrar un desvío verificable. '
                + (
                    localFailure?.message
                    ?? 'Puede faltar cartografía o una conexión válida.'
                ),
        );
    }

    for (let attempt = 0; attempt < 4; attempt++) {
        if (blocked.size > 300) {
            throw new RoutingError(
                422,
                'La zona requiere demasiadas restricciones. No se aplicó una ruta sin verificar.',
            );
        }

        let route: CalculatedRoute;

        try {
            route = await calculateRoute({
                ...input,
                blockedSegmentIds: [...blocked],
            });
        } catch (error) {
            if (
                !(error instanceof RoutingError)
                || error.statusCode !== 422
            ) {
                throw error;
            }

            const delta = 25 / 111320;

            const deltaLng =
                delta / Math.cos(origin[1] * Math.PI / 180);

            const candidates = queryPedestrianSegments({
                south: origin[1] - delta,
                north: origin[1] + delta,
                west: origin[0] - deltaLng,
                east: origin[0] + deltaLng,
            }, 501);

            const anchors = new Map<string, Point>();

            for (const segment of candidates) {
                anchors.set(
                    segment.from,
                    segment.coordinates[0]!,
                );

                anchors.set(
                    segment.to,
                    segment.coordinates.at(-1)!,
                );
            }

            const nearest = [...anchors.values()]
                .filter((point) =>
                    distanceMeters(origin, point) <= 25
                )
                .sort((a, b) =>
                    distanceMeters(origin, a)
                    - distanceMeters(origin, b)
                )
                .slice(0, 6);

            let alternative: CalculatedRoute | null = null;

            for (const point of nearest) {
                for (const item of constraints) {
                    if (
                        !contains(item.constraint.free, origin)
                        || !contains(item.constraint.free, point)
                    ) {
                        continue;
                    }

                    try {
                        const prefix = connectOnSurface(
                            origin,
                            point,
                            item.constraint,
                        );

                        const rest = await calculateRoute({
                            ...input,
                            origin: {
                                lng: point[0],
                                lat: point[1],
                            },
                            blockedSegmentIds: [...blocked],
                        });

                        if (
                            distanceMeters(
                                rest.geometry.coordinates[0]!,
                                point,
                            ) > 0.02
                        ) {
                            continue;
                        }

                        alternative = {
                            ...rest,
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    ...prefix,
                                    ...rest.geometry.coordinates.slice(1),
                                ],
                            },
                        };

                        break;
                    } catch (failure) {
                        if (
                            !(failure instanceof SurfaceGeometryError)
                            && !(failure instanceof RoutingError)
                        ) {
                            throw failure;
                        }
                    }
                }

                if (alternative) break;
            }

            if (!alternative) throw unavailable();

            route = alternative;
        }

        let coordinates = route.geometry.coordinates;

        let failed: typeof constraints[number] | null = null;

        for (const item of constraints) {
            const began = performance.now();

            try {
                coordinates = adaptLine(
                    coordinates,
                    item.constraint,
                );
            } catch (error) {
                if (!(error instanceof SurfaceGeometryError)) {
                    throw error;
                }

                failed = item;
                localFailure = error;
                if (
                    process.env.SURFACE_DEBUG === '1'
                    && attempt === 0
                ) {
                    const reproduction = {
                        version: 1,
                        coordinates,
                        constraint: item.constraint,
                        widthMeters: context.widthMeters,
                        lateralMarginMeters: context.lateralMarginMeters,
                        state: error.state,
                        reason: error.message,
                    };

                    const encoded = gzipSync(
                        Buffer.from(
                            JSON.stringify(reproduction),
                            'utf8',
                        ),
                    ).toString('base64');

                    console.warn(
                        '[Superficies: reproducción]',
                        encoded,
                    );
                }

                const first = coordinates[0];
                const last = coordinates.at(-1);

                console.warn(
                    '[Superficies: paso local descartado]',
                    JSON.stringify({
                        simulationId: context.simulationId,
                        attempt: attempt + 1,
                        state: error.state,
                        reason: error.message,
                        elapsedMs: Math.round(
                            performance.now() - began,
                        ),

                        widthMeters: context.widthMeters,
                        lateralMarginMeters:
                            context.lateralMarginMeters,

                        requiredWidthMeters:
                            robotRadius(context) * 2,

                        originInsideFreeSurface: first
                            ? contains(
                                item.constraint.free,
                                first,
                            )
                            : false,

                        destinationInsideFreeSurface: last
                            ? contains(
                                item.constraint.free,
                                last,
                            )
                            : false,

                        surfaceIncidents: incidents
                            .filter((incident) =>
                                Boolean(incident.surfaceImpact)
                            )
                            .map((incident) => ({
                                id: incident.id,
                                surfaceCount:
                                    incident.surfaceImpact
                                        ?.surfaces.length ?? 0,
                                contextSurfaceCount:
                                    incident.surfaceImpact
                                        ?.contextSurfaces?.length
                                    ?? incident.surfaceImpact
                                        ?.surfaces.length
                                    ?? 0,
                            })),
                    }),
                );

                break;
            }
        }
        if (!failed) {
            if (
                !coordinates.length
                || distanceMeters(coordinates[0]!, origin) > 0.02
                || distanceMeters(
                    coordinates.at(-1)!,
                    [finish.lng, finish.lat],
                ) > 0.02
            ) {
                throw new RoutingError(
                    422,
                    'La alternativa no conserva los extremos de la entrega.',
                );
            }

            if (
                constraints.some((item) =>
                    lineHits(
                        coordinates,
                        item.constraint.danger,
                    )
                )
            ) {
                throw new RoutingError(
                    422,
                    'La geometría propuesta todavía alcanza un obstáculo.',
                );
            }

            const blockedAreas = (
                Array.isArray(input.blockedAreas)
                    ? input.blockedAreas
                    : []
            ) as BlockedArea[];

            if (
                routeIntersectsBlockedAreas(
                    coordinates,
                    blockedAreas,
                )
            ) {
                throw new RoutingError(
                    422,
                    'La alternativa local alcanza un bloqueo general. No se aplicó.',
                );
            }

            let distance = 0;

            for (
                let index = 1;
                index < coordinates.length;
                index++
            ) {
                distance += distanceMeters(
                    coordinates[index - 1]!,
                    coordinates[index]!,
                );
            }

            return {
                ...route,
                geometry: {
                    type: 'LineString',
                    coordinates,
                },
                distanceMeters: distance,
                durationSeconds: distance / (5 / 3.6),
            };
        }

        const region = failed.constraint.danger;

        const candidates = queryPedestrianSegments(
            areaBounds(region),
            1001,
        );

        const previousSize = blocked.size;

        for (const segment of candidates) {
            if (lineHits(segment.coordinates, region)) {
                blocked.add(segment.id);
            }
        }

        if (blocked.size === previousSize) {
            throw unavailable();
        }
    }

    throw unavailable();
}

