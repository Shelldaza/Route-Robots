import {
  distanceMeters,
} from '../pedestrian-network';

import type {
  PedestrianSegment,
} from '../../../../shared/contracts/pedestrian';

type Point = [number, number];

const CELL = 0.0002;

// Solo considera superposición longitudinal:
// tocar una esquina no equivale a ocupar el recorrido.
function overlap(
    start: Point,
    end: Point,
    a: Point,
    b: Point,
): boolean {
    const scaleX =
        111320 * Math.cos(start[1] * Math.PI / 180);

    const dx = (end[0] - start[0]) * scaleX;
    const dy = (end[1] - start[1]) * 111320;
    const length = Math.hypot(dx, dy);

    if (length < 0.001) return false;

    const ax = (a[0] - start[0]) * scaleX;
    const ay = (a[1] - start[1]) * 111320;
    const bx = (b[0] - start[0]) * scaleX;
    const by = (b[1] - start[1]) * 111320;

    if (
        Math.abs(ax * dy - ay * dx) / length > 0.15
        || Math.abs(bx * dy - by * dx) / length > 0.15
    ) {
        return false;
    }

    const ta = (ax * dx + ay * dy) / length;
    const tb = (bx * dx + by * dy) / length;

    return (
        Math.min(length, Math.max(ta, tb))
        - Math.max(0, Math.min(ta, tb))
    ) > 0.02;
}

function cells(a: Point, b: Point) {
    const keys: string[] = [];
    const pad = 0.000002;

    for (
        let x = Math.floor(
            (Math.min(a[0], b[0]) - pad) / CELL,
        );
        x <= Math.floor(
            (Math.max(a[0], b[0]) + pad) / CELL,
        );
        x++
    ) {
        for (
            let y = Math.floor(
                (Math.min(a[1], b[1]) - pad) / CELL,
            );
            y <= Math.floor(
                (Math.max(a[1], b[1]) + pad) / CELL,
            );
            y++
        ) {
            keys.push(`${x}:${y}`);
        }
    }

    return keys;
}

export function createRouteMatcher(
    coordinates: Point[],
) {
    const index = new Map<
        string,
        { a: Point; b: Point }[]
    >();

    for (let i = 1; i < coordinates.length; i++) {
        const edge = {
            a: coordinates[i - 1]!,
            b: coordinates[i]!,
        };

        for (const key of cells(edge.a, edge.b)) {
            if (!index.has(key)) {
                index.set(key, []);
            }

            index.get(key)!.push(edge);
        }
    }

    return (segment: PedestrianSegment) => {
        for (
            let i = 1;
            i < segment.coordinates.length;
            i++
        ) {
            const a = segment.coordinates[i - 1]!;
            const b = segment.coordinates[i]!;

            for (const key of cells(a, b)) {
                for (const edge of index.get(key) ?? []) {
                    if (overlap(edge.a, edge.b, a, b)) {
                        return true;
                    }
                }
            }
        }

        return false;
    };
}

export function segmentMidpoint(
    segment: PedestrianSegment,
): Point {
    const points = segment.coordinates;

    const lengths = points.slice(1).map(
        (point, index) =>
            distanceMeters(points[index]!, point),
    );

    let remaining = lengths.reduce(
        (sum, value) => sum + value,
        0,
    ) / 2;

    for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i]!;

        if (remaining <= length && length > 0) {
            const a = points[i]!;
            const b = points[i + 1]!;
            const t = remaining / length;

            return [
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
            ];
        }

        remaining -= length;
    }

    return [...points[0]!];
}
