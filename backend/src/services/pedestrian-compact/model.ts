// Columnas compartidas. La red sigue representada por arrays numéricos.
import type { PedestrianNetwork } from '../../../../shared/contracts/pedestrian';


export type Strings = {
    bytes: Uint8Array;
    offsets: Uint32Array;
};


export type CompactNetwork = {
    format: 1;
    metadata: Omit<PedestrianNetwork, 'segments'>;
    ids: Strings;
    nodeIds: Strings;
    names: Strings;
    kinds: Uint8Array;
    ways: Float64Array;
    xy: Float64Array;
    shapes: Uint32Array;
    shapeOffsets: Uint32Array;
    offsets: Uint32Array;
    targets: Uint32Array;
    arcSegments: Uint32Array;
    lengths: Float64Array;
    grid: {
        minX: number;
        minY: number;
        width: number;
        height: number;
    };
    cellOffsets: Uint32Array;
    cellSegments: Uint32Array;
};


export const CELL = 0.002;


export const kinds = [
    'sidewalk',
    'crossing',
    'path',
] as const;