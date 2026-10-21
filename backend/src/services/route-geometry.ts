import type { BlockedArea } from './routing';

import type { Coordinate } from '../../../shared/contracts/geography';

function segmentIntersectsArea(
    start: Coordinate,
    end: Coordinate,
    area: BlockedArea,
): boolean {
    const [startLng, startLat] = start;
    const [endLng, endLat] = end;

    const deltaLng = endLng - startLng;
    const deltaLat = endLat - startLat;

    let entry = 0;
    let exit = 1;

    // Recorte del segmento contra los cuatro lados del rectángulo.
    const boundaries: [number, number][] = [
        [-deltaLng, startLng - area.west],
        [deltaLng, area.east - startLng],
        [-deltaLat, startLat - area.south],
        [deltaLat, area.north - startLat],
    ];

    for (const [direction, distance] of boundaries) {
        if (direction === 0) {
            if (distance < 0) return false;
            continue;
        }

        const fraction = distance / direction;

        if (direction < 0) {
            entry = Math.max(entry, fraction);
        } else {
            exit = Math.min(exit, fraction);
        }

        if (entry > exit) return false;
    }

    return true;
}

export function routeIntersectsBlockedAreas(
    coordinates: Coordinate[],
    blockedAreas: BlockedArea[],
): boolean {
    for (let index = 1; index < coordinates.length; index += 1) {
        const start = coordinates[index - 1];
        const end = coordinates[index];

        if (!start || !end) continue;

        for (const area of blockedAreas) {
            if (segmentIntersectsArea(start, end, area)) {
                return true;
            }
        }
    }

    return false;
}