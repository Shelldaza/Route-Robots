// Consultas por ID y región sin reconstruir toda la red como objetos.
import type { PedestrianSegment } from '../../../../shared/contracts/pedestrian';
import type { Coordinate as Point, Bounds } from '../../../../shared/contracts/geography';
import { CELL, kinds } from './model';
import type { CompactNetwork } from './model';
import { stringAt } from './strings';
import { pointAt } from './coordinates';


export function segmentIndex(
    net: CompactNetwork,
    id: string,
): number {
    let low = 0;
    let high = net.ways.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const value = stringAt(net.ids, mid);

        if (value === id) return mid;

        if (value < id) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return -1;
}


export function segmentAt(
    net: CompactNetwork,
    index: number,
): PedestrianSegment {
    const start = net.shapeOffsets[index]!;
    const end = net.shapeOffsets[index + 1]!;
    const coordinates: Point[] = [];

    for (let i = start; i < end; i++) {
        coordinates.push(
            pointAt(net, net.shapes[i]!),
        );
    }

    return {
        id: stringAt(net.ids, index),
        wayId: net.ways[index]!,
        from: stringAt(net.nodeIds, net.shapes[start]!),
        to: stringAt(net.nodeIds, net.shapes[end - 1]!),
        kind: kinds[net.kinds[index]!]!,
        name: stringAt(net.names, index),
        coordinates,
    };
}


export function segmentIndicesInBounds(
    net: CompactNetwork,
    bounds: Bounds,
    limit = Infinity,
): number[] {
    const { grid } = net;

    const minX = Math.max(
        0,
        Math.floor(bounds.west / CELL) - grid.minX,
    );
    const maxX = Math.min(
        grid.width - 1,
        Math.floor(bounds.east / CELL) - grid.minX,
    );
    const minY = Math.max(
        0,
        Math.floor(bounds.south / CELL) - grid.minY,
    );
    const maxY = Math.min(
        grid.height - 1,
        Math.floor(bounds.north / CELL) - grid.minY,
    );

    const seen = new Set<number>();
    const found: number[] = [];

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const cell = y * grid.width + x;

            for (
                let i = net.cellOffsets[cell]!;
                i < net.cellOffsets[cell + 1]!;
                i++
            ) {
                const segment = net.cellSegments[i]!;

                if (seen.has(segment)) continue;
                seen.add(segment);

                let west = Infinity;
                let south = Infinity;
                let east = -Infinity;
                let north = -Infinity;

                for (
                    let j = net.shapeOffsets[segment]!;
                    j < net.shapeOffsets[segment + 1]!;
                    j++
                ) {
                    const node = net.shapes[j]!;
                    const lng = net.xy[node * 2]!;
                    const lat = net.xy[node * 2 + 1]!;

                    west = Math.min(west, lng);
                    east = Math.max(east, lng);
                    south = Math.min(south, lat);
                    north = Math.max(north, lat);
                }

                if (
                    west <= bounds.east
                    && east >= bounds.west
                    && south <= bounds.north
                    && north >= bounds.south
                ) {
                    found.push(segment);

                    if (found.length >= limit) {
                        return found;
                    }
                }
            }
        }
    }

    return found;
}