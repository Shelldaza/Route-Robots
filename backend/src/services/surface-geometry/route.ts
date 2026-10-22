// Reconstruye el recorrido y conserva sus secciones fuera de la maniobra local.
import { contains, cuts, interpolate, lineHits, local, mapArea, world } from '../../../../shared/surfaces';
import type { Point } from '../../../../shared/contracts/surfaces';
import type { SurfaceConstraint } from './constraints';
import { SurfaceGeometryError } from './error';
import { segmentInside, sameComponent, shortestPath } from './path';


export function adaptLine(
    points: Point[],
    constraint: SurfaceConstraint,
): Point[] {
    if (
        points.length < 2
        || !lineHits(points, constraint.danger)
    ) {
        return points;
    }

    const origin = points[0]!;

    const free = mapArea(
        constraint.free,
        (point) => local(point, origin),
    );

    const domain = mapArea(
        constraint.domain,
        (point) => local(point, origin),
    );

    const danger = mapArea(
        constraint.danger,
        (point) => local(point, origin),
    );

    const source = points.map((point) =>
        local(point, origin)
    );

    // Distancia acumulada sobre el recorrido original.
    const stations: number[] = [0];

    const EPS = 1e-6;
    const MAX_ACCESS_DISTANCE = 25;

    type Interval = {
        from: number;
        to: number;
        free: boolean;
    };

    type Collision = {
        from: number;
        to: number;
    };

    type Maneuver = {
        from: number;
        to: number;
        entry: number;
        exit: number;
    };

    const intervals: Interval[] = [];
    const hits: Collision[] = [];

    for (
        let index = 1;
        index < source.length;
        index++
    ) {
        const a = source[index - 1]!;
        const b = source[index]!;

        const length = Math.hypot(
            b[0] - a[0],
            b[1] - a[1],
        );

        const base = stations[index - 1]!;

        stations.push(base + length);

        if (length < EPS) continue;

        const values = [...new Set([
            0,
            1,
            ...cuts(free, a, b),
            ...cuts(danger, a, b),
        ])]
            .filter((value) =>
                value >= 0 && value <= 1
            )
            .sort((x, y) => x - y);

        // Incluye contactos tangenciales con el peligro.
        for (const value of values) {
            const point = interpolate(a, b, value);

            if (contains(danger, point)) {
                const distance = base + value * length;

                hits.push({
                    from: distance,
                    to: distance,
                });
            }
        }

        for (
            let part = 1;
            part < values.length;
            part++
        ) {
            const low = values[part - 1]!;
            const high = values[part]!;

            if ((high - low) * length < EPS) {
                continue;
            }

            const midpoint = interpolate(
                a,
                b,
                (low + high) / 2,
            );

            const from = base + low * length;
            const to = base + high * length;

            intervals.push({
                from,
                to,
                free: contains(free, midpoint),
            });

            if (contains(danger, midpoint)) {
                hits.push({ from, to });
            }
        }
    }

    // Une encuentros consecutivos con un obstáculo.
    const collisions: Collision[] = [];

    for (
        const hit
        of hits.sort((a, b) => a.from - b.from)
    ) {
        const previous = collisions.at(-1);

        if (
            previous
            && hit.from <= previous.to + EPS
        ) {
            previous.to = Math.max(
                previous.to,
                hit.to,
            );
        } else {
            collisions.push({ ...hit });
        }
    }

    function pointAt(distance: number): Point {
        for (
            let index = 1;
            index < source.length;
            index++
        ) {
            const start = stations[index - 1]!;
            const end = stations[index]!;

            if (
                distance <= end + EPS
                && end - start >= EPS
            ) {
                const fraction = Math.max(
                    0,
                    Math.min(
                        1,
                        (distance - start) / (end - start),
                    ),
                );

                return interpolate(
                    source[index - 1]!,
                    source[index]!,
                    fraction,
                );
            }
        }

        return source.at(-1)!;
    }

    function findAccess(
        distance: number,
        before: boolean,
    ): number {
        const ordered = before
            ? [...intervals].reverse()
            : intervals;

        for (const interval of ordered) {
            if (!interval.free) continue;

            const low = before
                ? interval.from
                : Math.max(interval.from, distance);

            const high = before
                ? Math.min(interval.to, distance)
                : interval.to;

            if (high - low < EPS) continue;

            // El acceso queda dentro del intervalo libre,
            // evitando depender de un punto en su borde.
            const inset = Math.min(
                1,
                (high - low) / 2,
            );

            const candidate = before
                ? high - inset
                : low + inset;

            if (
                Math.abs(candidate - distance)
                > MAX_ACCESS_DISTANCE
            ) {
                break;
            }

            if (contains(free, pointAt(candidate))) {
                return candidate;
            }
        }

        throw new SurfaceGeometryError(
            'unknown',
            'No se encontró un acceso libre sobre el recorrido a menos de 25 m del obstáculo. Puede faltar superficie o no coincidir el eje OSM.',
        );
    }

    function makeManeuver(
        from: number,
        to: number,
    ): Maneuver {
        return {
            from,
            to,
            entry: findAccess(from, true),
            exit: findAccess(to, false),
        };
    }

    if (!collisions.length) {
        throw new SurfaceGeometryError(
            'unknown',
            'No se pudo delimitar el encuentro del recorrido con el obstáculo.',
        );
    }

    const maneuvers: Maneuver[] = [];

    for (const collision of collisions) {
        let next = makeManeuver(
            collision.from,
            collision.to,
        );

        // Si dos maniobras se superponen, se resuelven juntas.
        while (
            maneuvers.length
            && next.entry <= maneuvers.at(-1)!.exit + EPS
        ) {
            const previous = maneuvers.pop()!;

            next = makeManeuver(
                previous.from,
                Math.max(previous.to, next.to),
            );
        }

        maneuvers.push(next);
    }

    const result: Point[] = [];

    function append(path: Point[]) {
        for (const point of path) {
            const previous = result.at(-1);

            if (
                !previous
                || Math.hypot(
                    point[0] - previous[0],
                    point[1] - previous[1],
                ) > EPS
            ) {
                result.push(point);
            }
        }
    }

    function originalSection(
        from: number,
        to: number,
    ): Point[] {
        return [
            pointAt(from),

            ...source.filter((_, index) =>
                stations[index]! > from + EPS
                && stations[index]! < to - EPS
            ),

            pointAt(to),
        ];
    }

    let cursor = 0;

    for (const maneuver of maneuvers) {
        const start = pointAt(maneuver.entry);
        const end = pointAt(maneuver.exit);

        if (!sameComponent(domain, start, end)) {
            throw new SurfaceGeometryError(
                'unknown',
                'Los accesos locales pertenecen a superficies desconectadas. Falta una conexión cartográfica verificada.',
            );
        }

        const path = shortestPath(
            free,
            start,
            end,
        );

        // Verifica todos los segmentos de la maniobra.
        for (
            let index = 1;
            index < path.length;
            index++
        ) {
            if (
                !segmentInside(
                    free,
                    path[index - 1]!,
                    path[index]!,
                )
            ) {
                throw new SurfaceGeometryError(
                    'unknown',
                    'La maniobra local sale del espacio libre verificado.',
                );
            }
        }

        append(
            originalSection(cursor, maneuver.entry),
        );

        append(path);

        cursor = maneuver.exit;
    }

    // Conserva el recorrido fuera de las maniobras locales.
    append(
        originalSection(
            cursor,
            stations.at(-1)!,
        ),
    );

    const converted = result.map((point) =>
        world(point, origin)
    );

    // Conserva exactamente los extremos originales.
    converted[0] = points[0]!;
    converted[converted.length - 1] = points.at(-1)!;

    if (
        lineHits(
            converted,
            constraint.danger,
        )
    ) {
        throw new SurfaceGeometryError(
            'unknown',
            'La alternativa local todavía alcanza un obstáculo.',
        );
    }

    return converted;
}


export function connectOnSurface(
    start: Point,
    end: Point,
    constraint: SurfaceConstraint,
): Point[] {
    const free = mapArea(
        constraint.free,
        (point) => local(point, start),
    );

    return shortestPath(
        free,
        [0, 0],
        local(end, start),
    ).map((point) => world(point, start));
}