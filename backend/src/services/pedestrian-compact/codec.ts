// Conserva el formato binario RRN1. El decoder valida antes de utilizar las columnas.
import { endianness } from 'node:os';
import type { CompactNetwork } from './model';
export { decodeCompactNetwork } from './decode';


// Guarda las columnas en un único archivo binario.
export function encodeCompactNetwork(
    net: CompactNetwork,
): Buffer {
    if (endianness() !== 'LE') {
        throw new Error(
            'La captura compacta requiere una plataforma little-endian.',
        );
    }

    const columns = {
        idBytes: net.ids.bytes,
        idOffsets: net.ids.offsets,
        nodeBytes: net.nodeIds.bytes,
        nodeOffsets: net.nodeIds.offsets,
        nameBytes: net.names.bytes,
        nameOffsets: net.names.offsets,
        kinds: net.kinds,
        ways: net.ways,
        xy: net.xy,
        shapes: net.shapes,
        shapeOffsets: net.shapeOffsets,
        offsets: net.offsets,
        targets: net.targets,
        arcSegments: net.arcSegments,
        lengths: net.lengths,
        cellOffsets: net.cellOffsets,
        cellSegments: net.cellSegments,
    };

    let size = 0;

    const arrays = Object.entries(columns).map(
        ([name, values]) => {
            size = Math.ceil(size / 8) * 8;

            const descriptor = {
                name,
                type:
                    values instanceof Float64Array
                        ? 'f64'
                        : values instanceof Uint32Array
                          ? 'u32'
                          : 'u8',
                offset: size,
                length: values.length,
            };

            size += values.byteLength;
            return descriptor;
        },
    );

    const header = Buffer.from(
        JSON.stringify({
            format: 1,
            metadata: net.metadata,
            grid: net.grid,
            arrays,
        }),
    );

    const base =
        Math.ceil((8 + header.length) / 8) * 8;

    const result = Buffer.alloc(base + size);

    result.write('RRN1', 0);
    result.writeUInt32LE(header.length, 4);
    header.copy(result, 8);

    for (const descriptor of arrays) {
        const values =
            columns[
                descriptor.name as keyof typeof columns
            ];

        Buffer.from(
            values.buffer,
            values.byteOffset,
            values.byteLength,
        ).copy(result, base + descriptor.offset);
    }

    return result;
}