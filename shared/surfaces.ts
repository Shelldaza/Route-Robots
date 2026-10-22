import type { Area, Bounds, Box, Point } from './contracts/surfaces';
export type { Area, Bounds, Box, Point, WalkSurface, SurfaceImpact } from './contracts/surfaces';

export const EMPTY: Area = {
    type: 'MultiPolygon',
    coordinates: [],
};

export function isArea(value: unknown): value is Area {
    if (!value || typeof value !== 'object') return false;

    const area = value as Area;

    return (
        area.type === 'MultiPolygon'
        && Array.isArray(area.coordinates)
        && area.coordinates.every((polygon) =>
            Array.isArray(polygon)
            && polygon.length > 0
            && polygon.every((ring) =>
                Array.isArray(ring)
                && ring.length >= 4
                && ring.every((point) =>
                    Array.isArray(point)
                    && point.length === 2
                    && point.every((n) =>
                        typeof n === 'number'
                        && Number.isFinite(n)
                    )
                )
                && ring[0]![0] === ring.at(-1)![0]
                && ring[0]![1] === ring.at(-1)![1]
            )
        )
    );
}

export function local(point: Point, origin: Point): Point {
    return [
        (point[0] - origin[0])
            * 111320
            * Math.cos(origin[1] * Math.PI / 180),
        (point[1] - origin[1]) * 111320,
    ];
}

export function world(point: Point, origin: Point): Point {
    return [
        origin[0]
            + point[0]
            / (111320 * Math.cos(origin[1] * Math.PI / 180)),
        origin[1] + point[1] / 111320,
    ];
}

export function mapArea(
    area: Area,
    transform: (point: Point) => Point,
): Area {
    return {
        type: 'MultiPolygon',
        coordinates: area.coordinates.map((polygon) =>
            polygon.map((ring) => ring.map(transform))
        ),
    };
}

export function boxArea(box: Box): Area {
    const c = Math.cos(box.angle);
    const s = Math.sin(box.angle);

    const corners: Point[] = [
        [-box.halfWidth, -box.halfLength],
        [box.halfWidth, -box.halfLength],
        [box.halfWidth, box.halfLength],
        [-box.halfWidth, box.halfLength],
    ];

    const points = corners.map(([x, y]) =>
        world(
            [x * c - y * s, x * s + y * c],
            box.center,
        )
    );

    return {
        type: 'MultiPolygon',
        coordinates: [[[...points, points[0]!]]],
    };
}

export function areaBounds(
    area: Area,
    paddingMeters = 0,
): Bounds {
    const points = area.coordinates.flat(2);

    if (!points.length) {
        throw new Error('La superficie está vacía.');
    }

    const latitude = points[0]![1];
    const dy = paddingMeters / 111320;
    const dx = dy / Math.cos(latitude * Math.PI / 180);

    return {
        south: Math.min(...points.map((p) => p[1])) - dy,
        north: Math.max(...points.map((p) => p[1])) + dy,
        west: Math.min(...points.map((p) => p[0])) - dx,
        east: Math.max(...points.map((p) => p[0])) + dx,
    };
}

function onEdge(point: Point, a: Point, b: Point): boolean {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);

    if (!length) {
        return Math.hypot(
            point[0] - a[0],
            point[1] - a[1],
        ) < 1e-9;
    }

    return (
        Math.abs(
            (point[0] - a[0]) * dy
            - (point[1] - a[1]) * dx,
        ) / length < 1e-9
        && (point[0] - a[0]) * dx
            + (point[1] - a[1]) * dy >= -1e-12
        && (point[0] - b[0]) * dx
            + (point[1] - b[1]) * dy <= 1e-12
    );
}

function ringContains(ring: Point[], point: Point): number {
    let inside = false;

    for (let index = 1; index < ring.length; index++) {
        const a = ring[index - 1]!;
        const b = ring[index]!;

        if (onEdge(point, a, b)) return 2;

        if (
            (a[1] > point[1]) !== (b[1] > point[1])
            && point[0]
                < (b[0] - a[0])
                    * (point[1] - a[1])
                    / (b[1] - a[1])
                    + a[0]
        ) {
            inside = !inside;
        }
    }

    return inside ? 1 : 0;
}

export function contains(area: Area, point: Point): boolean {
    return area.coordinates.some((polygon) => {
        if (!ringContains(polygon[0]!, point)) return false;

        for (const hole of polygon.slice(1)) {
            const result = ringContains(hole, point);

            if (result === 2) return true;
            if (result === 1) return false;
        }

        return true;
    });
}

export function cuts(
    area: Area,
    a: Point,
    b: Point,
): number[] {
    const result = [0, 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;

    if (!length2) return result;

    for (const polygon of area.coordinates) {
        for (const ring of polygon) {
            for (let index = 1; index < ring.length; index++) {
                const c = ring[index - 1]!;
                const d = ring[index]!;
                const sx = d[0] - c[0];
                const sy = d[1] - c[1];
                const denominator = dx * sy - dy * sx;

                if (
                    Math.abs(denominator)
                    <= 1e-12
                        * Math.sqrt(length2)
                        * Math.hypot(sx, sy)
                ) {
                    for (const point of [c, d]) {
                        if (onEdge(point, a, b)) {
                            result.push(
                                (
                                    (point[0] - a[0]) * dx
                                    + (point[1] - a[1]) * dy
                                ) / length2,
                            );
                        }
                    }

                    continue;
                }

                const t = (
                    (c[0] - a[0]) * sy
                    - (c[1] - a[1]) * sx
                ) / denominator;

                const u = (
                    (c[0] - a[0]) * dy
                    - (c[1] - a[1]) * dx
                ) / denominator;

                if (t > 0 && t < 1 && u >= 0 && u <= 1) {
                    result.push(t);
                }
            }
        }
    }

    return [...new Set(result)].sort((x, y) => x - y);
}

export function interpolate(
    a: Point,
    b: Point,
    fraction: number,
): Point {
    return [
        a[0] + (b[0] - a[0]) * fraction,
        a[1] + (b[1] - a[1]) * fraction,
    ];
}

export function lineHits(
    points: readonly Point[],
    area: Area,
): boolean {
    if (!area.coordinates.length) return false;

    const bounds = areaBounds(area);

    for (let index = 1; index < points.length; index++) {
        const a = points[index - 1]!;
        const b = points[index]!;

        if (
            Math.max(a[0], b[0]) < bounds.west
            || Math.min(a[0], b[0]) > bounds.east
            || Math.max(a[1], b[1]) < bounds.south
            || Math.min(a[1], b[1]) > bounds.north
        ) {
            continue;
        }

        const parts = cuts(area, a, b);

        for (let part = 1; part < parts.length; part++) {
            const midpoint = interpolate(
                a,
                b,
                (parts[part - 1]! + parts[part]!) / 2,
            );

            if (contains(area, midpoint)) return true;
        }
    }

    return false;
}