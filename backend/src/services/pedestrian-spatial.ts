import {
    queryCompactSegments,
} from './pedestrian-network';
import type {
    Bounds,
} from './pedestrian-compact';

export type NetworkBounds = Bounds;

export function queryPedestrianSegments(
    bounds: NetworkBounds,
    limit = Infinity,
) {
    return queryCompactSegments(bounds, limit);
}