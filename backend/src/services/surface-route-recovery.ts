import {
    contains,
    cuts,
    interpolate,
    lineHits,
    local,
} from '../../../shared/surfaces';

import type { Area, Point, WalkSurface } from '../../../shared/contracts/surfaces'

import {
    distanceMeters,
} from './pedestrian-network';

import {
    queryPedestrianSegments,
} from './pedestrian-spatial';

import {
    robotRadius,
} from './surface-incidents';

import {
    calculateSurfaceRoute,
    surfaceConstraints,
} from './surface-routing-core';

import {
    RoutingError,
} from './routing';

import {
    routeRequestSchema,
} from '../schemas/routing';

import {
    routeIntersectsBlockedAreas,
} from './route-geometry';

import type {
    CalculatedRoute,
} from './routing';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

type Connector = {
    points: Point[];
    length: number;
    segmentIds: string[];
};

// Límite de la conexión inicial o final sobre un tramo.
//
// No limita la distancia del desvío que calcula el grafo.
const MAX_DISTANCE = 250;

// Conservamos pocas conexiones cercanas para evitar probar
// una cantidad excesiva de combinaciones.
const MAX_ANCHORS = 4;

// Tolerancia numérica para reconocer la posición sobre el eje.
// No habilita saltos a otra vereda.
const MATCH_METERS = 0.02;

function length(
    points: Point[],
): number {
    return points.slice(1).reduce(
        (sum, point, index) =>
            sum + distanceMeters(
                points[index]!,
                point,
            ),
        0,
    );
}

/**
 * Comprueba si una trayectoria alcanza una zona de peligro.
 *
 * Además de los cruces, rechazamos contactos con el borde
 * del margen de seguridad.
 */
function touches(
    points: Point[],
    danger: Area,
): boolean {
    if (
        points.some((point) =>
            contains(danger, point)
        )
        || lineHits(points, danger)
    ) {
        return true;
    }

    return points.slice(1).some((b, index) => {
        const a = points[index]!;

        return cuts(danger, a, b).some((fraction) =>
            contains(
                danger,
                interpolate(a, b, fraction),
            )
        );
    });
}

/**
 * Busca caminos desde un punto hasta los extremos de su tramo.
 *
 * Solo utiliza geometrías del servidor. No une el punto con
 * una esquina mediante una línea recta arbitraria.
 */
function connectors(
    point: Point,
    blocked: Set<string>,
    safe: (points: Point[]) => boolean,
): Connector[] {
    // Mantener el punto original también es una posibilidad:
    // quizá solo necesitemos reconectar el otro extremo.
    const result: Connector[] = [{
        points: [point],
        length: 0,
        segmentIds: [],
    }];

    const delta = 1 / 111320;

    const dx =
        delta / Math.cos(point[1] * Math.PI / 180);

    const segments = queryPedestrianSegments(
        {
            west: point[0] - dx,
            east: point[0] + dx,
            south: point[1] - delta,
            north: point[1] + delta,
        },
        501,
    );

    if (segments.length > 500) {
        return result;
    }

    for (const segment of segments) {
        // Un cierre explícito por ID mantiene su alcance completo.
        //
        // La recuperación está destinada a obstáculos de superficie
        // que afectan una parte del tramo, no a ignorar cierres manuales.
        if (blocked.has(segment.id)) {
            continue;
        }

        const shape = segment.coordinates;

        for (
            let index = 1;
            index < shape.length;
            index++
        ) {
            const a = shape[index - 1]!;
            const b = shape[index]!;

            const ab = local(b, a);
            const ap = local(point, a);

            const size =
                ab[0] ** 2 + ab[1] ** 2;

            if (size < 1e-6) {
                continue;
            }

            const fraction = Math.max(
                0,
                Math.min(
                    1,
                    (
                        ap[0] * ab[0]
                        + ap[1] * ab[1]
                    ) / size,
                ),
            );

            const projection = interpolate(
                a,
                b,
                fraction,
            );

            // Reconocemos un punto que ya está sobre este eje.
            // No acercamos el robot desde otra calle o vereda.
            if (
                distanceMeters(
                    point,
                    projection,
                ) > MATCH_METERS
            ) {
                continue;
            }

            // Desde la proyección podemos recorrer el tramo
            // hacia cualquiera de sus extremos.
            const paths: Point[][] = [
                [
                    point,
                    projection,
                    ...shape.slice(0, index).reverse(),
                ],
                [
                    point,
                    projection,
                    ...shape.slice(index),
                ],
            ];

            for (const path of paths) {
                const meters = length(path);

                if (
                    meters < MATCH_METERS
                    || meters > MAX_DISTANCE
                    || !safe(path)
                ) {
                    continue;
                }

                const end = path.at(-1)!;

                const repeated = result.some((item) =>
                    distanceMeters(
                        item.points.at(-1)!,
                        end,
                    ) < 0.001
                );

                if (repeated) {
                    continue;
                }

                result.push({
                    points: path,
                    length: meters,
                    segmentIds: [segment.id],
                });
            }
        }
    }

    return result
        .sort((a, b) => a.length - b.length)
        .slice(0, MAX_ANCHORS);
}

/**
 * Recupera conexiones perdidas al bloquear una arista completa.
 *
 * Ejemplo:
 * - el robot está en la mitad de una vereda;
 * - hay una obra más adelante;
 * - el grafo cierra el tramo completo;
 * - todavía es posible retroceder por su parte libre.
 *
 * Esta función verifica esa retirada, calcula el recorrido entre
 * conexiones del grafo y comprueba la geometría completa al terminar.
 */
export async function recoverSurfaceRoute(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
    knownSurfaces: WalkSurface[] = [],
): Promise<CalculatedRoute | null> {
    const parsed = routeRequestSchema.safeParse(value);

    if (
        !parsed.success
        || parsed.data.networkVersion
            !== context.networkVersion
    ) {
        return null;
    }

    const input = parsed.data;

    const active = incidents.filter((incident) =>
        incident.effect === 'blockage'
    );

    const impacts = active.flatMap((incident) =>
        incident.surfaceImpact
            ? [incident.surfaceImpact]
            : []
    );

    if (!impacts.length) {
        return null;
    }

    const constraints = surfaceConstraints(
        impacts,
        robotRadius(context),
        knownSurfaces,
        active,
    );

    // Las conexiones deben evitar todos los incidentes activos
    // y también las restricciones generales de la solicitud.
    const safe = (points: Point[]) =>
        constraints.every((item) =>
            !touches(
                points,
                item.constraint.danger,
            )
        )
        && !routeIntersectsBlockedAreas(
            points,
            input.blockedAreas ?? [],
        );

    const origin: Point = [
        input.origin.lng,
        input.origin.lat,
    ];

    const destination: Point = [
        input.destination.lng,
        input.destination.lat,
    ];

    if (
        !safe([origin])
        || !safe([destination])
    ) {
        return null;
    }

    const blocked = new Set(
        input.blockedSegmentIds ?? [],
    );

    // Evaluamos los dos extremos porque ambos podrían estar
    // en partes libres de un mismo tramo bloqueado.
    const starts = connectors(
        origin,
        blocked,
        safe,
    );

    const finishes = connectors(
        destination,
        blocked,
        safe,
    );

    const pairs = starts
        .flatMap((start) =>
            finishes.map((finish) => ({
                start,
                finish,
            }))
        )
        .filter((pair) =>
            pair.start.length
                + pair.finish.length > 0
        )
        .sort((a, b) =>
            a.start.length
            + a.finish.length
            - b.start.length
            - b.finish.length
        );

    for (const { start, finish } of pairs) {
        const a = start.points.at(-1)!;
        const b = finish.points.at(-1)!;

        if (
            distanceMeters(a, b) < MATCH_METERS
        ) {
            continue;
        }

        let middle: CalculatedRoute;

        try {
            // Entre estas conexiones volvemos a utilizar el motor
            // habitual, con los mismos incidentes y restricciones.
            //
            // Importamos el núcleo directamente para no iniciar
            // otra recuperación recursiva.
            middle = await calculateSurfaceRoute(
                {
                    ...input,
                    origin: {
                        lng: a[0],
                        lat: a[1],
                    },
                    destination: {
                        lng: b[0],
                        lat: b[1],
                    },
                    strictOrigin: true,
                },
                context,
                active,
                knownSurfaces,
            );
        } catch (error) {
            if (
                !(error instanceof RoutingError)
                || error.statusCode !== 422
            ) {
                throw error;
            }

            continue;
        }

        const route = middle.geometry.coordinates;

        // La ruta intermedia debe pertenecer a nuestra red
        // y conservar las conexiones que solicitamos.
        if (
            middle.provider !== 'pedestrian-sandbox'
            || middle.networkVersion
                !== context.networkVersion
            || route.length < 2
            || distanceMeters(
                route[0]!,
                a,
            ) > MATCH_METERS
            || distanceMeters(
                route.at(-1)!,
                b,
            ) > MATCH_METERS
        ) {
            continue;
        }

        // El conector final está guardado desde el destino
        // hacia el grafo. Lo invertimos para llegar al destino.
        const points = [
            ...start.points,
            ...route.slice(1, -1),
            ...[...finish.points].reverse(),
        ].filter((point, index, all) =>
            index === 0
            || distanceMeters(
                all[index - 1]!,
                point,
            ) > 0.000001
        );

        if (
            points.length < 2
            || !safe(points)
        ) {
            continue;
        }

        const meters = length(points);

        console.info(
            '[Superficies: reconexión por tramo libre]',
            JSON.stringify({
                simulationId: context.simulationId,
                originConnectorMeters: start.length,
                destinationConnectorMeters: finish.length,
                distanceMeters: meters,
            }),
        );

        return {
            ...middle,
            geometry: {
                type: 'LineString',
                coordinates: points,
            },
            segmentIds: [
                ...new Set([
                    ...start.segmentIds,
                    ...(middle.segmentIds ?? []),
                    ...finish.segmentIds,
                ]),
            ],
            distanceMeters: meters,
            durationSeconds: meters / (5 / 3.6),
        };
    }

    return null;
}