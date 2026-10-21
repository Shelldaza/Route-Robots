import C from 'clipper-lib';

import {
    contains,
    cuts,
    interpolate,
    lineHits,
    local,
    mapArea,
    world,
    EMPTY,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
} from '../../../shared/surfaces';

export class SurfaceGeometryError extends Error {
    constructor(
        public readonly state: 'blocked' | 'unknown',
        message: string,
    ) {
        super(message);
    }
}

function anchor(area: Area): Point {
    return area.coordinates[0]?.[0]?.[0] ?? [0, 0];
}

function paths(area: Area, origin: Point): C.Paths {
    return area.coordinates.flatMap((polygon) =>
        polygon.map((ring, index) => {
            const result = ring.slice(0, -1).map((point) => {
                const projected = local(point, origin);

                return {
                    X: Math.round(projected[0] * 1000),
                    Y: Math.round(projected[1] * 1000),
                };
            });

            if (C.Clipper.Orientation(result) !== (index === 0)) {
                result.reverse();
            }

            return result;
        })
    );
}

function fromTree(tree: C.PolyTree, origin: Point): Area {
    function ring(path: C.Path): Point[] {
        const result = path.map((point) =>
            world([point.X / 1000, point.Y / 1000], origin)
        );

        return [...result, result[0]!];
    }

    return {
        type: 'MultiPolygon',
        coordinates: C.JS.PolyTreeToExPolygons(tree).map(
            (polygon) => [
                ring(polygon.outer),
                ...polygon.holes.map(ring),
            ],
        ),
    };
}

export function booleanArea(
    a: Area,
    b: Area,
    operation: 'union' | 'intersection' | 'difference',
): Area {
    const origin = a.coordinates.length ? anchor(a) : anchor(b);
    const clipper = new C.Clipper();

    clipper.AddPaths(paths(a, origin), C.PolyType.ptSubject, true);
    clipper.AddPaths(paths(b, origin), C.PolyType.ptClip, true);

    const tree = new C.PolyTree();

    const type =
        operation === 'union'
            ? C.ClipType.ctUnion
            : operation === 'intersection'
                ? C.ClipType.ctIntersection
                : C.ClipType.ctDifference;

    clipper.Execute(
        type,
        tree,
        C.PolyFillType.pftNonZero,
        C.PolyFillType.pftNonZero,
    );

    return fromTree(tree, origin);
}

export function offsetArea(area: Area, meters: number): Area {
    if (!area.coordinates.length) return EMPTY;

    const origin = anchor(area);
    const tree = new C.PolyTree();
    const offset = new C.ClipperOffset(2, 2);

    offset.AddPaths(
        paths(area, origin),
        C.JoinType.jtRound,
        C.EndType.etClosedPolygon,
    );

    offset.Execute(tree, meters * 1000);

    return fromTree(tree, origin);
}

export function squareMeters(area: Area): number {
    return Math.abs(
        paths(area, anchor(area)).reduce(
            (sum, ring) => sum + C.Clipper.Area(ring),
            0,
        ),
    ) / 1000000;
}

export function unionAreas(areas: Area[]): Area {
    return areas.reduce(
        (result, area) => booleanArea(result, area, 'union'),
        EMPTY,
    );
}

function segmentInside(
    area: Area,
    a: Point,
    b: Point,
): boolean {
    if (!contains(area, a) || !contains(area, b)) return false;

    const parts = cuts(area, a, b);

    for (let index = 1; index < parts.length; index++) {
        if (!contains(
            area,
            interpolate(
                a,
                b,
                (parts[index - 1]! + parts[index]!) / 2,
            ),
        )) {
            return false;
        }
    }

    return true;
}

function sameComponent(
    area: Area,
    start: Point,
    end: Point,
): boolean {
    return area.coordinates.some((polygon) => {
        const component: Area = {
            type: 'MultiPolygon',
            coordinates: [polygon],
        };

        return contains(component, start)
            && contains(component, end);
    });
}

function shortestPath(
    free: Area,
    start: Point,
    end: Point,
): Point[] {
    if (
        !contains(free, start)
        || !contains(free, end)
    ) {
        throw new SurfaceGeometryError(
            'unknown',
            'El eje OSM no coincide con un acceso libre de la superficie cartográfica.',
        );
    }

    if (segmentInside(free, start, end)) {
        return [start, end];
    }

    const polygon = free.coordinates.find((candidate) => {
        const area: Area = {
            type: 'MultiPolygon',
            coordinates: [candidate],
        };

        return (
            contains(area, start)
            && contains(area, end)
        );
    });

    if (!polygon) {
        throw new SurfaceGeometryError(
            'blocked',
            'El espacio libre quedó separado: no hay paso continuo para este robot.',
        );
    }

    const component: Area = {
        type: 'MultiPolygon',
        coordinates: [polygon],
    };

    const began = performance.now();

    const TIME_LIMIT_MS = 500;
    const MAX_VERTICES = 350;

    let limitedCandidates = false;

    function expired(): boolean {
        return performance.now() - began > TIME_LIMIT_MS;
    }

    function timeout(): never {
        throw new SurfaceGeometryError(
            'unknown',
            'No se pudo verificar el paso local dentro del tiempo disponible.',
        );
    }

    // Intenta primero una maniobra próxima al obstáculo.
    // Amplía la búsqueda únicamente si hace falta.
    for (const padding of [2, 5, 10, 25]) {
        if (expired()) timeout();

        const west =
            Math.min(start[0], end[0]) - padding;

        const east =
            Math.max(start[0], end[0]) + padding;

        const south =
            Math.min(start[1], end[1]) - padding;

        const north =
            Math.max(start[1], end[1]) + padding;

        // Los segmentos entre candidatos permanecen dentro
        // del rectángulo de búsqueda. Un hueco completamente
        // exterior no puede afectar esos segmentos.
        const relevantHoles = polygon
            .slice(1)
            .filter((ring) => {
                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;

                for (const point of ring) {
                    minX = Math.min(minX, point[0]);
                    maxX = Math.max(maxX, point[0]);
                    minY = Math.min(minY, point[1]);
                    maxY = Math.max(maxY, point[1]);
                }

                return (
                    minX <= east
                    && maxX >= west
                    && minY <= north
                    && maxY >= south
                );
            });

        const searchArea: Area = {
            type: 'MultiPolygon',
            coordinates: [[
                polygon[0]!,
                ...relevantHoles,
            ]],
        };

        const candidates: Point[] = [];
        const keys = new Set<string>();

        function add(point: Point) {
            const distanceToStart = Math.hypot(
                point[0] - start[0],
                point[1] - start[1],
            );

            const distanceToEnd = Math.hypot(
                point[0] - end[0],
                point[1] - end[1],
            );

            if (
                distanceToStart < 1e-7
                || distanceToEnd < 1e-7
                || !contains(searchArea, point)
            ) {
                return;
            }

            const key = [
                Math.round(point[0] * 1000000),
                Math.round(point[1] * 1000000),
            ].join(':');

            if (keys.has(key)) return;

            keys.add(key);
            candidates.push(point);
        }

        // Recorta los bordes para obtener candidatos locales.
        // No modifica la superficie usada para la validación final.
        function addClippedEdge(
            a: Point,
            b: Point,
        ) {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];

            let low = 0;
            let high = 1;

            const tests: [number, number][] = [
                [-dx, a[0] - west],
                [dx, east - a[0]],
                [-dy, a[1] - south],
                [dy, north - a[1]],
            ];

            for (const [p, q] of tests) {
                if (Math.abs(p) < 1e-12) {
                    if (q < 0) return;
                    continue;
                }

                const t = q / p;

                if (p < 0) {
                    low = Math.max(low, t);
                } else {
                    high = Math.min(high, t);
                }

                if (low > high) return;
            }

            add(interpolate(a, b, low));
            add(interpolate(a, b, high));
        }

        for (const ring of searchArea.coordinates[0]!) {
            if (expired()) timeout();

            for (
                let index = 1;
                index < ring.length;
                index++
            ) {
                addClippedEdge(
                    ring[index - 1]!,
                    ring[index]!,
                );

                if (
                    index % 64 === 0
                    && expired()
                ) {
                    timeout();
                }
            }
        }

        add([west, south]);
        add([east, south]);
        add([east, north]);
        add([west, north]);

        // Una superficie compleja ya no provoca un rechazo
        // inmediato: se priorizan candidatos cercanos a la maniobra.
        if (candidates.length > MAX_VERTICES) {
            limitedCandidates = true;

            function score(point: Point): number {
                return (
                    Math.hypot(
                        point[0] - start[0],
                        point[1] - start[1],
                    )
                    + Math.hypot(
                        point[0] - end[0],
                        point[1] - end[1],
                    )
                );
            }

            candidates.sort((a, b) =>
                score(a) - score(b)
            );

            candidates.length = MAX_VERTICES;
        }

        const nodes = [
            start,
            end,
            ...candidates,
        ];

        const distances = nodes.map(() => Infinity);
        const previous = nodes.map(() => -1);
        const used = nodes.map(() => false);

        const estimates = nodes.map((point) =>
            Math.hypot(
                point[0] - end[0],
                point[1] - end[1],
            )
        );

        distances[0] = 0;

        // A*: combina distancia recorrida y distancia a la salida.
        while (true) {
            if (expired()) timeout();

            let current = -1;
            let best = Infinity;

            for (
                let index = 0;
                index < nodes.length;
                index++
            ) {
                const score =
                    distances[index]!
                    + estimates[index]!;

                if (
                    !used[index]
                    && score < best
                ) {
                    best = score;
                    current = index;
                }
            }

            if (current < 0) break;

            if (current === 1) {
                const result: Point[] = [];

                for (
                    let index = 1;
                    index >= 0;
                    index = previous[index]!
                ) {
                    result.push(nodes[index]!);
                }

                result.reverse();

                // Valida la trayectoria completa contra
                // la superficie original, con todos sus huecos.
                for (
                    let index = 1;
                    index < result.length;
                    index++
                ) {
                    if (
                        !segmentInside(
                            component,
                            result[index - 1]!,
                            result[index]!,
                        )
                    ) {
                        throw new SurfaceGeometryError(
                            'unknown',
                            'La maniobra local no pudo validarse contra la superficie original.',
                        );
                    }
                }

                return result;
            }

            used[current] = true;

            const a = nodes[current]!;

            for (
                let index = 0;
                index < nodes.length;
                index++
            ) {
                if (
                    index % 16 === 0
                    && expired()
                ) {
                    timeout();
                }

                if (used[index]) continue;

                const b = nodes[index]!;

                const distance =
                    distances[current]!
                    + Math.hypot(
                        b[0] - a[0],
                        b[1] - a[1],
                    );

                if (
                    distance < distances[index]!
                    && segmentInside(searchArea, a, b)
                ) {
                    distances[index] = distance;
                    previous[index] = current;
                }
            }
        }
    }

    throw new SurfaceGeometryError(
        'unknown',
        limitedCandidates
            ? 'No se pudo verificar el paso local con el límite de candidatos disponible. Esto no demuestra que la vereda esté bloqueada.'
            : 'No se pudo verificar una conexión local dentro del área de búsqueda.',
    );
}

export type SurfaceConstraint = {
    domain: Area;
    free: Area;
    danger: Area;
};

export function makeConstraint(
    surface: Area,
    obstacles: Area,
    radius: number,
): SurfaceConstraint {
    const domain = offsetArea(surface, -radius - 0.02);

    return {
        domain,
        free: booleanArea(
            domain,
            offsetArea(obstacles, radius + 0.02),
            'difference',
        ),
        danger: offsetArea(obstacles, radius + 0.01),
    };
}

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