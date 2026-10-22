// Conserva la búsqueda local, sus tolerancias y sus límites actuales.
import { contains, cuts, interpolate } from '../../../../shared/surfaces';
import type { Area, Point } from '../../../../shared/contracts/surfaces';
import { SurfaceGeometryError } from './error';


export function segmentInside(
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


export function sameComponent(
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


export function shortestPath(
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