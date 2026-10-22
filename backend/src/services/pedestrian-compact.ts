// Entrada pública compatible con los consumidores y el script de preparación.
export type { Bounds } from '../../../shared/contracts/geography';
export type { CompactNetwork } from './pedestrian-compact/model';
export { encodeCompactNetwork, decodeCompactNetwork } from './pedestrian-compact/codec';
export { compileNetwork } from './pedestrian-compact/compiler';
export { distanceMeters } from './pedestrian-compact/coordinates';
export { segmentIndex, segmentAt, segmentIndicesInBounds } from './pedestrian-compact/spatial';
export { routeOnCompactNetwork } from './pedestrian-compact/routing';
export type { PedestrianRouteInput } from './pedestrian-compact/routing';
