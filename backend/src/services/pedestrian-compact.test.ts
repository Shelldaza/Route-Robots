import {
    expect,
    it,
} from 'vitest';

import {
    compileNetwork,
    encodeCompactNetwork,
    decodeCompactNetwork,
    routeOnCompactNetwork,
    segmentIndicesInBounds,
} from './pedestrian-compact';

import type {
    PedestrianNetwork,
} from '../../../shared/contracts/pedestrian';

const network: PedestrianNetwork = {
    version: 'test',
    name: 'Prueba',
    source: 'fixture',
    retrievedAt: '2026-10-21',
    attribution: 'Prueba',

    bounds: {
        south: 38.899,
        west: -77.041,
        north: 38.902,
        east: -77.038,
    },

    segments: [
        {
            id: 'a',
            wayId: 1,
            from: 'n1',
            to: 'n2',
            kind: 'sidewalk',
            name: '',
            coordinates: [
                [-77.04, 38.9],
                [-77.039, 38.9],
            ],
        },
        {
            id: 'b',
            wayId: 2,
            from: 'n2',
            to: 'n3',
            kind: 'crossing',
            name: 'Cruce',
            coordinates: [
                [-77.039, 38.9],
                [-77.039, 38.901],
            ],
        },
    ],
};

function bytes() {
    return encodeCompactNetwork(
        compileNetwork(network),
    );
}

function headerOf(buffer: Buffer) {
    return JSON.parse(
        buffer.toString(
            'utf8',
            8,
            8 + buffer.readUInt32LE(4),
        ),
    );
}

// Modifica el encabezado conservando las columnas originales.
// Permite probar datos malformados sin cambiar el compilador.
function changeHeader(
    change: (
        header: ReturnType<typeof headerOf>,
    ) => void,
) {
    const original = bytes();
    const header = headerOf(original);

    const oldBase = Math.ceil(
        (8 + original.readUInt32LE(4)) / 8,
    ) * 8;

    change(header);

    const json = Buffer.from(
        JSON.stringify(header),
    );

    const base =
        Math.ceil((8 + json.length) / 8) * 8;

    const result = Buffer.alloc(
        base + original.length - oldBase,
    );

    result.write('RRN1');
    result.writeUInt32LE(json.length, 4);

    json.copy(result, 8);
    original.copy(result, base, oldBase);

    return result;
}

function changeColumn(
    name: string,
    change: (
        buffer: Buffer,
        offset: number,
    ) => void,
) {
    const buffer = bytes();
    const header = headerOf(buffer);

    const column = header.arrays.find(
        (item: { name: string }) =>
            item.name === name,
    )!;

    const base = Math.ceil(
        (8 + buffer.readUInt32LE(4)) / 8,
    ) * 8;

    change(buffer, base + column.offset);

    return buffer;
}

it('conserva las consultas y la ruta tras compilar, codificar y decodificar', () => {
    const original = compileNetwork(network);

    const decoded = decodeCompactNetwork(
        encodeCompactNetwork(original),
    );

    const input = {
        origin: {
            lng: -77.04,
            lat: 38.9,
        },
        destination: {
            lng: -77.039,
            lat: 38.901,
        },
        strictOrigin: true,
    };

    expect(
        routeOnCompactNetwork(input, decoded),
    ).toEqual(
        routeOnCompactNetwork(input, original),
    );

    expect(
        segmentIndicesInBounds(
            decoded,
            network.bounds,
        ),
    ).toEqual(
        segmentIndicesInBounds(
            original,
            network.bounds,
        ),
    );

    expect(() =>
        routeOnCompactNetwork(
            {
                ...input,
                blockedSegmentIds: ['b'],
            },
            decoded,
        )
    ).toThrow('No hay conexión');
});

it('mantiene vistas sobre el mismo buffer, también con un desplazamiento alineado', () => {
    const original = bytes();

    const storage = Buffer.alloc(
        original.length + 8,
    );

    original.copy(storage, 8);

    const input = storage.subarray(8);
    const decoded = decodeCompactNetwork(input);

    expect(decoded.xy.buffer)
        .toBe(input.buffer);

    expect(decoded.ids.bytes.buffer)
        .toBe(input.buffer);

    const header = headerOf(input);

    const base = Math.ceil(
        (8 + input.readUInt32LE(4)) / 8,
    ) * 8;

    const column = header.arrays.find(
        (item: { name: string }) =>
            item.name === 'ways',
    );

    // Si la columna comparte el buffer, observa este cambio.
    input.writeDoubleLE(
        99,
        base + column.offset,
    );

    expect(decoded.ways[0]).toBe(99);
});

it.each([
    Buffer.alloc(0),
    Buffer.from('RRN1'),
    Buffer.from('INVALID!'),
])(
    'rechaza firmas y encabezados incompletos',
    (input) => {
        expect(() =>
            decodeCompactNetwork(input)
        ).toThrow('Captura compacta inválida');
    },
);

it.each([
    (header: ReturnType<typeof headerOf>) => {
        header.format = 2;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.metadata.bounds.east = -200;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.grid.width = 0;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays.pop();
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[1].name =
            header.arrays[0].name;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[0].name = 'unknown';
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[0].type = 'f64';
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[0].offset = -1;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[0].offset = 1;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[0].length =
            Number.MAX_SAFE_INTEGER;
    },
    (header: ReturnType<typeof headerOf>) => {
        header.arrays[1].offset =
            header.arrays[0].offset;
    },
])(
    'rechaza un encabezado con columnas o metadatos inválidos',
    (change) => {
        expect(() =>
            decodeCompactNetwork(
                changeHeader(change),
            )
        ).toThrow('Captura compacta inválida');
    },
);

it.each([
    [
        'kinds',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt8(255, offset),
    ],
    [
        'shapes',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(
                0xffffffff,
                offset,
            ),
    ],
    [
        'shapeOffsets',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(1, offset),
    ],
    [
        'targets',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(
                0xffffffff,
                offset,
            ),
    ],
    [
        'arcSegments',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(
                0xffffffff,
                offset,
            ),
    ],
    [
        'cellSegments',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(
                0xffffffff,
                offset,
            ),
    ],
    [
        'cellOffsets',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(1, offset),
    ],
    [
        'xy',
        (buffer: Buffer, offset: number) =>
            buffer.writeDoubleLE(NaN, offset),
    ],
    [
        'lengths',
        (buffer: Buffer, offset: number) =>
            buffer.writeDoubleLE(-1, offset),
    ],
    [
        'idOffsets',
        (buffer: Buffer, offset: number) =>
            buffer.writeUInt32LE(1, offset),
    ],
] as const)(
    'rechaza referencias o valores inválidos en %s',
    (name, change) => {
        expect(() =>
            decodeCompactNetwork(
                changeColumn(name, change),
            )
        ).toThrow('Captura compacta inválida');
    },
);

it('rechaza un archivo truncado o con longitud de encabezado fuera del buffer', () => {
    const input = bytes();

    expect(() =>
        decodeCompactNetwork(
            input.subarray(0, input.length - 1),
        )
    ).toThrow('Captura compacta inválida');

    input.writeUInt32LE(input.length, 4);

    expect(() =>
        decodeCompactNetwork(input)
    ).toThrow('Captura compacta inválida');
});