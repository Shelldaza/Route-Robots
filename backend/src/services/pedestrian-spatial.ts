import {
    queryCompactSegments,
} from './pedestrian-network';
import type { Bounds } from '../../../shared/contracts/geography'

export type NetworkBounds = Bounds;

export function queryPedestrianSegments(
    bounds: NetworkBounds,
    limit = Infinity,
) {
    return queryCompactSegments(bounds, limit);
}