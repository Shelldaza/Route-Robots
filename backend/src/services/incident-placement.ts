import { z } from 'zod';

import { RoutingError } from './routing';

import {
    pedestrianNetwork,
} from './pedestrian-network';

import {
    queryPedestrianSegments,
} from './pedestrian-spatial';

import {
    queryWalkSurfaces,
} from './walk-surfaces';

import {
    getSurfaceContext,
} from './surface-incidents';

import {
    unionAreas,
} from './surface-geometry';

import {
    areaBounds,
    boxArea,
    contains,
    cuts,
    interpolate,
    lineHits,
    local,
    world,
} from '../../../shared/surfaces';

import type { Area, Point, Box } from '../../../shared/contracts/surfaces'

export const placementSchema = z.strictObject({
    simulationId: z.uuid(),
    networkVersion: z.string().min(1),

    point: z.tuple([
        z.number().finite().min(-180).max(180),
        z.number().finite().min(-90).max(90),
    ]),
});

export function initialSurfaceBox(
    point: Point,
    surface: Area,
    angle: number,
): Box {
    const normal: Point = [
        -Math.sin(angle),
        Math.cos(angle),
    ];

    const a = world([
        -normal[0] * 20,
        -normal[1] * 20,
    ], point);

    const b = world([
        normal[0] * 20,
        normal[1] * 20,
    ], point);

    const parts = cuts(surface, a, b);

    for (
        let index = 1;
        index < parts.length;
        index++
    ) {
        const low = parts[index - 1]!;
        const high = parts[index]!;

        if (
            low > 0.5 + 1e-8
            || high < 0.5 - 1e-8
        ) {
            continue;
        }

        if (
            !contains(
                surface,
                interpolate(a, b, (low + high) / 2),
            )
        ) {
            continue;
        }

        const halfLength = Math.max(
            0.1,
            Math.min(
                20,
                (high - low) * 20,
            ),
        );

        return {
            center: interpolate(
                a,
                b,
                (low + high) / 2,
            ),
            halfWidth: 0.5,
            halfLength,
            angle,
        };
    }

    throw new RoutingError(
        422,
        'No se pudieron identificar los bordes de la vereda en ese punto. Probá unos centímetros hacia su interior.',
    );
}

export async function placeIncident(
    input: z.infer<typeof placementSchema>,
    signal?: AbortSignal,
) {
    const context = await getSurfaceContext(
        input.simulationId,
    );

    if (
        !context
        || context.networkVersion !== input.networkVersion
        || input.networkVersion !== pedestrianNetwork.version
    ) {
        throw new RoutingError(
            409,
            'La entrega y la red del escenario no coinciden.',
        );
    }

    const point = input.point;

    const bounds = areaBounds(
        boxArea({
            center: point,
            halfWidth: 0.1,
            halfLength: 0.1,
            angle: 0,
        }),
        25,
    );

    const surfaces = (
        await queryWalkSurfaces(bounds, 'current', signal)
    ).filter((surface) =>
        [1480, 1483].includes(surface.code)
    );

    signal?.throwIfAborted();
    const near = queryPedestrianSegments(
        bounds,
        1001,
    );

    if (near.length > 1000) {
        throw new RoutingError(
            413,
            'La zona contiene demasiados tramos. Elegí un punto más preciso.',
        );
    }

    const candidates = near
        .flatMap((segment) =>
            segment.coordinates.slice(1).map((b, index) => {
                const a = segment.coordinates[index]!;

                const av = local(a, point);
                const bv = local(b, point);

                const dx = bv[0] - av[0];
                const dy = bv[1] - av[1];
                const length2 = dx * dx + dy * dy;

                const fraction = length2
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            -(av[0] * dx + av[1] * dy)
                                / length2,
                        ),
                    )
                    : 0;

                const projected = interpolate(
                    a,
                    b,
                    fraction,
                );

                const p = local(projected, point);

                return {
                    segment,
                    a,
                    b,
                    projected,
                    distance: Math.hypot(p[0], p[1]),
                    angle: Math.atan2(dy, dx),
                };
            })
        )
        .sort((a, b) =>
            a.distance - b.distance
        );

    const touched = surfaces.filter((surface) =>
        contains(surface.geometry, point)
    );

    if (!touched.length) {
        const closest = candidates[0];

        if (
            !closest
            || closest.distance > 5
        ) {
            throw new RoutingError(
                422,
                'En ese punto no hay una superficie ni un tramo peatonal cercano. Elegí una línea peatonal del mapa.',
            );
        }

        return {
            mode: 'segment' as const,
            segment: closest.segment,
            message:
                'No hay superficie cartográfica en este punto. El reporte afectará el tramo seleccionado; no se puede comprobar el espacio lateral.',
        };
    }

    const vertices = surfaces.reduce(
        (sum, surface) =>
            sum + surface.geometry.coordinates.flat(2).length,
        0,
    );

    if (
        surfaces.length > 80
        || vertices > 15000
    ) {
        throw new RoutingError(
            413,
            'La zona es demasiado compleja para ajustar el área automáticamente.',
        );
    }

    const area = unionAreas(
        surfaces.map((surface) => surface.geometry),
    );

    const axis = candidates.find((candidate) =>
        candidate.distance <= 20
        && touched.some((surface) =>
            contains(
                surface.geometry,
                candidate.projected,
            )
            && lineHits(
                [candidate.a, candidate.b],
                surface.geometry,
            )
        )
    );

    let angle = axis?.angle;

    if (angle === undefined) {
        let longest = 0;
        angle = 0;

        for (const surface of touched) {
            for (
                const polygon
                of surface.geometry.coordinates
            ) {
                const ring = polygon[0]!;

                for (
                    let index = 1;
                    index < ring.length;
                    index++
                ) {
                    const a = local(
                        ring[index - 1]!,
                        point,
                    );

                    const b = local(
                        ring[index]!,
                        point,
                    );

                    const length = Math.hypot(
                        b[0] - a[0],
                        b[1] - a[1],
                    );

                    if (length > longest) {
                        longest = length;

                        angle = Math.atan2(
                            b[1] - a[1],
                            b[0] - a[0],
                        );
                    }
                }
            }
        }
    }

    return {
        mode: 'surface' as const,

        box: initialSurfaceBox(
            point,
            area,
            angle,
        ),

        message:
            'Área inicial orientada según la vereda. Revisá su tamaño antes de confirmar; el largo inicial es de 1 metro y el ancho se limita a los bordes encontrados, hasta 40 metros.',
    };
}
