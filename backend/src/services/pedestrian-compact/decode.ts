import { endianness } from 'node:os';

import type {
    CompactNetwork,
    Strings,
} from './model';

import {
    CELL,
    kinds,
} from './model';

import {
    stringAt,
} from './strings';

// Cada columna tiene un nombre y un tipo binario definidos.
// El archivo no puede elegir libremente cómo interpretar sus bytes.
const schema = {
    idBytes: 'u8',
    idOffsets: 'u32',
    nodeBytes: 'u8',
    nodeOffsets: 'u32',
    nameBytes: 'u8',
    nameOffsets: 'u32',
    kinds: 'u8',
    ways: 'f64',
    xy: 'f64',
    shapes: 'u32',
    shapeOffsets: 'u32',
    offsets: 'u32',
    targets: 'u32',
    arcSegments: 'u32',
    lengths: 'f64',
    cellOffsets: 'u32',
    cellSegments: 'u32',
} as const;

type ColumnName = keyof typeof schema;

type NumericArray =
    | Uint8Array
    | Uint32Array
    | Float64Array;

function invalid(reason: string): never {
    throw new Error(
        `Captura compacta inválida: ${reason}.`,
    );
}

function record(
    value: unknown,
): value is Record<string, unknown> {
    return (
        value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
    );
}

function integer(
    value: unknown,
): value is number {
    return (
        typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 0
    );
}

function finite(
    value: unknown,
): value is number {
    return (
        typeof value === 'number'
        && Number.isFinite(value)
    );
}

function columnName(
    value: unknown,
): value is ColumnName {
    return (
        typeof value === 'string'
        && Object.hasOwn(schema, value)
    );
}

function metadata(
    value: unknown,
): value is CompactNetwork['metadata'] {
    if (
        !record(value)
        || !record(value.bounds)
    ) {
        return false;
    }

    const bounds = value.bounds;

    return (
        typeof value.version === 'string'
        && value.version.length > 0
        && typeof value.name === 'string'
        && typeof value.attribution === 'string'
        && typeof value.source === 'string'
        && typeof value.retrievedAt === 'string'
        && finite(bounds.south)
        && finite(bounds.north)
        && finite(bounds.west)
        && finite(bounds.east)
        && bounds.south >= -90
        && bounds.north <= 90
        && bounds.south < bounds.north
        && bounds.west >= -180
        && bounds.east <= 180
        && bounds.west < bounds.east
    );
}

function grid(
    value: unknown,
): value is CompactNetwork['grid'] {
    return (
        record(value)
        && Number.isSafeInteger(value.minX)
        && Number.isSafeInteger(value.minY)
        && integer(value.width)
        && value.width > 0
        && integer(value.height)
        && value.height > 0
        && Number.isSafeInteger(
            value.width * value.height,
        )
    );
}

// Comprueba columnas de desplazamientos:
// empiezan en cero, avanzan ordenadamente y terminan donde corresponde.
function offsets(
    values: Uint32Array,
    count: number,
    end: number,
    label: string,
    minimumStep = 0,
) {
    if (
        values.length !== count + 1
        || values[0] !== 0
        || values[count] !== end
    ) {
        invalid(label);
    }

    for (
        let index = 1;
        index < values.length;
        index++
    ) {
        if (
            values[index]!
                < values[index - 1]! + minimumStep
            || values[index]! > end
        ) {
            invalid(label);
        }
    }
}

function indices(
    values: Uint32Array,
    count: number,
    label: string,
) {
    for (const value of values) {
        if (value >= count) {
            invalid(label);
        }
    }
}

// Valida la estructura sin reconstruir todos los tramos como objetos.
// Las columnas devueltas comparten el Buffer original.
export function decodeCompactNetwork(
    bytes: Buffer,
): CompactNetwork {
    if (endianness() !== 'LE') {
        throw new Error(
            'La captura compacta requiere una plataforma little-endian.',
        );
    }

    if (
        bytes.length < 8
        || !bytes
            .subarray(0, 4)
            .equals(Buffer.from('RRN1'))
    ) {
        invalid('firma o encabezado incompleto');
    }

    const size = bytes.readUInt32LE(4);

    if (
        !size
        || size > bytes.length - 8
    ) {
        invalid('longitud del encabezado');
    }

    let header: unknown;

    try {
        header = JSON.parse(
            bytes.toString('utf8', 8, 8 + size),
        );
    } catch {
        invalid('JSON del encabezado');
    }

    if (
        !record(header)
        || header.format !== 1
        || !metadata(header.metadata)
        || !grid(header.grid)
        || !Array.isArray(header.arrays)
        || header.arrays.length
            !== Object.keys(schema).length
    ) {
        invalid('estructura del encabezado');
    }

    const base =
        Math.ceil((8 + size) / 8) * 8;

    if (base > bytes.length) {
        invalid('alineación del encabezado');
    }

    const columns =
        new Map<ColumnName, NumericArray>();

    const spans: {
        start: number;
        end: number;
    }[] = [];

    for (const column of header.arrays) {
        if (
            !record(column)
            || !columnName(column.name)
            || column.type !== schema[column.name]
            || !integer(column.offset)
            || !integer(column.length)
            || columns.has(column.name)
        ) {
            invalid('descriptor de columna');
        }

        const width =
            column.type === 'f64'
                ? 8
                : column.type === 'u32'
                    ? 4
                    : 1;

        const start = base + column.offset;
        const end = start + column.length * width;

        if (
            !Number.isSafeInteger(start)
            || !Number.isSafeInteger(end)
            || end > bytes.length
            || column.offset % 8 !== 0
            || (
                bytes.byteOffset + start
            ) % width !== 0
        ) {
            invalid(
                'posición, tamaño o alineación de columna',
            );
        }

        const offset = bytes.byteOffset + start;

        // Son vistas, no copias de los datos.
        const values =
            column.type === 'f64'
                ? new Float64Array(
                    bytes.buffer,
                    offset,
                    column.length,
                )
                : column.type === 'u32'
                    ? new Uint32Array(
                        bytes.buffer,
                        offset,
                        column.length,
                    )
                    : new Uint8Array(
                        bytes.buffer,
                        offset,
                        column.length,
                    );

        columns.set(column.name, values);
        spans.push({ start, end });
    }

    spans.sort(
        (a, b) =>
            a.start - b.start
            || a.end - b.end,
    );

    let end = base;

    for (const span of spans) {
        if (span.start < end) {
            invalid('columnas superpuestas');
        }

        end = Math.max(end, span.end);
    }

    if (end !== bytes.length) {
        invalid('tamaño total del archivo');
    }

    function u8(name: ColumnName): Uint8Array {
        const value = columns.get(name);

        if (!(value instanceof Uint8Array)) {
            invalid(`columna ${name}`);
        }

        return value;
    }

    function u32(name: ColumnName): Uint32Array {
        const value = columns.get(name);

        if (!(value instanceof Uint32Array)) {
            invalid(`columna ${name}`);
        }

        return value;
    }

    function f64(name: ColumnName): Float64Array {
        const value = columns.get(name);

        if (!(value instanceof Float64Array)) {
            invalid(`columna ${name}`);
        }

        return value;
    }

    const net: CompactNetwork = {
        format: 1,
        metadata: header.metadata,
        grid: header.grid,

        ids: {
            bytes: u8('idBytes'),
            offsets: u32('idOffsets'),
        },

        nodeIds: {
            bytes: u8('nodeBytes'),
            offsets: u32('nodeOffsets'),
        },

        names: {
            bytes: u8('nameBytes'),
            offsets: u32('nameOffsets'),
        },

        kinds: u8('kinds'),
        ways: f64('ways'),
        xy: f64('xy'),
        shapes: u32('shapes'),
        shapeOffsets: u32('shapeOffsets'),
        offsets: u32('offsets'),
        targets: u32('targets'),
        arcSegments: u32('arcSegments'),
        lengths: f64('lengths'),
        cellOffsets: u32('cellOffsets'),
        cellSegments: u32('cellSegments'),
    };

    const segments = net.ways.length;
    const nodes = net.xy.length / 2;
    const arcs = net.targets.length;

    if (
        !segments
        || !Number.isSafeInteger(nodes)
        || !nodes
        || net.kinds.length !== segments
        || net.arcSegments.length !== arcs
        || net.lengths.length !== arcs
    ) {
        invalid(
            'longitudes de columnas relacionadas',
        );
    }

    function strings(
        values: Strings,
        count: number,
        label: string,
        nonempty = false,
    ) {
        offsets(
            values.offsets,
            count,
            values.bytes.length,
            label,
            nonempty ? 1 : 0,
        );
    }

    strings(
        net.ids,
        segments,
        'IDs de tramos',
        true,
    );

    strings(
        net.nodeIds,
        nodes,
        'IDs de nodos',
        true,
    );

    strings(net.names, segments, 'nombres');

    offsets(
        net.shapeOffsets,
        segments,
        net.shapes.length,
        'geometrías',
        2,
    );

    offsets(
        net.offsets,
        nodes,
        arcs,
        'adyacencias',
    );

    offsets(
        net.cellOffsets,
        net.grid.width * net.grid.height,
        net.cellSegments.length,
        'celdas',
    );

    indices(
        net.shapes,
        nodes,
        'referencias de geometría',
    );

    indices(
        net.targets,
        nodes,
        'destinos del grafo',
    );

    indices(
        net.arcSegments,
        segments,
        'tramos del grafo',
    );

    indices(
        net.cellSegments,
        segments,
        'tramos del índice espacial',
    );

    for (const kind of net.kinds) {
        if (kind >= kinds.length) {
            invalid('tipo de tramo');
        }
    }

    for (const way of net.ways) {
        if (
            !Number.isSafeInteger(way)
            || way < 0
        ) {
            invalid('ID de vía');
        }
    }

    for (const length of net.lengths) {
        if (
            !Number.isFinite(length)
            || length < 0
        ) {
            invalid('distancia del grafo');
        }
    }

    for (let index = 0; index < nodes; index++) {
        const lng = net.xy[index * 2]!;
        const lat = net.xy[index * 2 + 1]!;

        if (
            !Number.isFinite(lng)
            || !Number.isFinite(lat)
            || Math.abs(lng) > 180
            || Math.abs(lat) > 90
        ) {
            invalid('coordenadas');
        }

        const x =
            Math.floor(lng / CELL) - net.grid.minX;

        const y =
            Math.floor(lat / CELL) - net.grid.minY;

        if (
            x < 0
            || y < 0
            || x >= net.grid.width
            || y >= net.grid.height
        ) {
            invalid('extensión del índice espacial');
        }
    }

    // La búsqueda binaria necesita IDs únicos y ordenados
    // con el mismo criterio utilizado por el compilador.
    let previous: string | undefined;

    for (
        let index = 0;
        index < segments;
        index++
    ) {
        const id = stringAt(net.ids, index);

        if (
            previous !== undefined
            && previous >= id
        ) {
            invalid('orden de IDs de tramos');
        }

        previous = id;
    }

    return net;
}