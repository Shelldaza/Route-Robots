import { pedestrianNetwork } from './pedestrian-network';
import type { PedestrianSegment } from './pedestrian-network';

export type NetworkBounds = {
    south: number;
    west: number;
    north: number;
    east: number;
};

const CELL_SIZE = 0.002;

const cells = new Map<string, Set<PedestrianSegment>>();
const envelopes = new Map<string, NetworkBounds>();

function cellRange(bounds: NetworkBounds) {
    return {
        minX: Math.floor(bounds.west / CELL_SIZE),
        maxX: Math.floor(bounds.east / CELL_SIZE),
        minY: Math.floor(bounds.south / CELL_SIZE),
        maxY: Math.floor(bounds.north / CELL_SIZE),
    };
}

// Se construye una sola vez al iniciar el backend.
for (const segment of pedestrianNetwork.segments) {
    const bounds = {
        south: Math.min(...segment.coordinates.map((p) => p[1])),
        west: Math.min(...segment.coordinates.map((p) => p[0])),
        north: Math.max(...segment.coordinates.map((p) => p[1])),
        east: Math.max(...segment.coordinates.map((p) => p[0])),
    };

    envelopes.set(segment.id, bounds);

    const range = cellRange(bounds);

    for (let x = range.minX; x <= range.maxX; x += 1) {
        for (let y = range.minY; y <= range.maxY; y += 1) {
            const key = `${x}:${y}`;

            if (!cells.has(key)) {
                cells.set(key, new Set());
            }

            cells.get(key)!.add(segment);
        }
    }
}

export function queryPedestrianSegments(
    bounds: NetworkBounds,
): PedestrianSegment[] {
    const range = cellRange(bounds);
    const candidates = new Set<PedestrianSegment>();

    for (let x = range.minX; x <= range.maxX; x += 1) {
        for (let y = range.minY; y <= range.maxY; y += 1) {
            for (const segment of cells.get(`${x}:${y}`) ?? []) {
                candidates.add(segment);
            }
        }
    }

    return [...candidates].filter((segment) => {
        const area = envelopes.get(segment.id)!;

        return (
            area.west <= bounds.east &&
            area.east >= bounds.west &&
            area.south <= bounds.north &&
            area.north >= bounds.south
        );
    });
}