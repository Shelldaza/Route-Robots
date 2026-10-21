import { endianness } from 'node:os';
import type { PedestrianNetwork, PedestrianSegment } from '../../../shared/contracts/pedestrian'
import {
    routeIntersectsBlockedAreas,
} from './route-geometry';

import type { Coordinate as Point, Bounds } from '../../../shared/contracts/geography';
export type { Bounds } from '../../../shared/contracts/geography';

type Strings = {
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

const CELL = 0.002;

const kinds = [
    'sidewalk',
    'crossing',
    'path',
] as const;

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

// Las columnas comparten el buffer leído del disco:
// no se crean copias completas de los datos.
export function decodeCompactNetwork(
    bytes: Buffer,
): CompactNetwork {
    if (endianness() !== 'LE') {
        throw new Error(
            'La captura compacta requiere una plataforma little-endian.',
        );
    }

    if (bytes.toString('ascii', 0, 4) !== 'RRN1') {
        throw new Error('Formato de red incompatible.');
    }

    const size = bytes.readUInt32LE(4);

    const header = JSON.parse(
        bytes.toString('utf8', 8, 8 + size),
    ) as {
        format: 1;
        metadata: CompactNetwork['metadata'];
        grid: CompactNetwork['grid'];
        arrays: {
            name: string;
            type: 'u8' | 'u32' | 'f64';
            offset: number;
            length: number;
        }[];
    };

    const base = Math.ceil((8 + size) / 8) * 8;

    const arrays: Record<
        string,
        Uint8Array | Uint32Array | Float64Array
    > = {};

    for (const column of header.arrays) {
        const Constructor =
            column.type === 'f64'
                ? Float64Array
                : column.type === 'u32'
                  ? Uint32Array
                  : Uint8Array;

        arrays[column.name] = new Constructor(
            bytes.buffer as ArrayBuffer,
            bytes.byteOffset + base + column.offset,
            column.length,
        );
    }

    return {
        format: header.format,
        metadata: header.metadata,
        grid: header.grid,
        ids: {
            bytes: arrays.idBytes as Uint8Array,
            offsets: arrays.idOffsets as Uint32Array,
        },
        nodeIds: {
            bytes: arrays.nodeBytes as Uint8Array,
            offsets: arrays.nodeOffsets as Uint32Array,
        },
        names: {
            bytes: arrays.nameBytes as Uint8Array,
            offsets: arrays.nameOffsets as Uint32Array,
        },
        kinds: arrays.kinds as Uint8Array,
        ways: arrays.ways as Float64Array,
        xy: arrays.xy as Float64Array,
        shapes: arrays.shapes as Uint32Array,
        shapeOffsets: arrays.shapeOffsets as Uint32Array,
        offsets: arrays.offsets as Uint32Array,
        targets: arrays.targets as Uint32Array,
        arcSegments: arrays.arcSegments as Uint32Array,
        lengths: arrays.lengths as Float64Array,
        cellOffsets: arrays.cellOffsets as Uint32Array,
        cellSegments: arrays.cellSegments as Uint32Array,
    };
}

export function distanceMeters(
    a: Point,
    b: Point,
): number {
    const rad = Math.PI / 180;

    const h =
        Math.sin((b[1] - a[1]) * rad / 2) ** 2
        + Math.cos(a[1] * rad)
        * Math.cos(b[1] * rad)
        * Math.sin((b[0] - a[0]) * rad / 2) ** 2;

    return 12742000 * Math.atan2(
        Math.sqrt(h),
        Math.sqrt(Math.max(0, 1 - h)),
    );
}

function encode(values: string[]): Strings {
    const offsets = new Uint32Array(values.length + 1);
    let size = 0;

    values.forEach((value, index) => {
        offsets[index] = size;
        size += Buffer.byteLength(value);
    });

    offsets[values.length] = size;

    const bytes = Buffer.allocUnsafe(size);

    values.forEach((value, index) => {
        bytes.write(value, offsets[index]!);
    });

    return { bytes, offsets };
}

function stringAt(
    strings: Strings,
    index: number,
): string {
    const start = strings.offsets[index]!;

    return Buffer.from(
        strings.bytes.buffer,
        strings.bytes.byteOffset + start,
        strings.offsets[index + 1]! - start,
    ).toString('utf8');
}

function pointAt(
    net: CompactNetwork,
    node: number,
): Point {
    return [
        net.xy[node * 2]!,
        net.xy[node * 2 + 1]!,
    ];
}

// Se ejecuta al preparar la captura, no al iniciar producción.
export function compileNetwork(
    network: PedestrianNetwork,
): CompactNetwork {
    const segments = [...network.segments].sort(
        (a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );

    if (!segments.length) {
        throw new Error('La red no tiene tramos.');
    }

    const nodes = new Map<string, number>();
    const nodeIds: string[] = [];
    const xy: number[] = [];
    const shapes: number[] = [];

    const shapeOffsets =
        new Uint32Array(segments.length + 1);
    const ways =
        new Float64Array(segments.length);
    const kindValues =
        new Uint8Array(segments.length);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    segments.forEach((segment, index) => {
        if (
            index > 0
            && segments[index - 1]!.id === segment.id
        ) {
            throw new Error(`ID repetido: ${segment.id}`);
        }

        if (segment.coordinates.length < 2) {
            throw new Error(`Tramo inválido: ${segment.id}`);
        }

        shapeOffsets[index] = shapes.length;
        ways[index] = segment.wayId;
        kindValues[index] = kinds.indexOf(segment.kind);

        segment.coordinates.forEach((point, i) => {
            const id =
                i === 0
                    ? segment.from
                    : i === segment.coordinates.length - 1
                      ? segment.to
                      : `${segment.id}:${i}`;

            let node = nodes.get(id);

            if (node === undefined) {
                node = nodes.size;
                nodes.set(id, node);
                nodeIds.push(id);
                xy.push(point[0], point[1]);
            } else if (
                xy[node * 2] !== point[0]
                || xy[node * 2 + 1] !== point[1]
            ) {
                throw new Error(
                    `Nodo con posiciones diferentes: ${id}`,
                );
            }

            shapes.push(node);

            minX = Math.min(
                minX,
                Math.floor(point[0] / CELL),
            );
            maxX = Math.max(
                maxX,
                Math.floor(point[0] / CELL),
            );
            minY = Math.min(
                minY,
                Math.floor(point[1] / CELL),
            );
            maxY = Math.max(
                maxY,
                Math.floor(point[1] / CELL),
            );
        });
    });

    shapeOffsets[segments.length] = shapes.length;

    // Grafo bidireccional en columnas numéricas.
    const offsets = new Uint32Array(nodes.size + 1);

    segments.forEach((_, segment) => {
        for (
            let i = shapeOffsets[segment]! + 1;
            i < shapeOffsets[segment + 1]!;
            i++
        ) {
            offsets[shapes[i - 1]! + 1]!++;
            offsets[shapes[i]! + 1]!++;
        }
    });

    for (let i = 1; i < offsets.length; i++) {
        offsets[i]! += offsets[i - 1]!;
    }

    const targets =
        new Uint32Array(offsets.at(-1)!);
    const arcSegments =
        new Uint32Array(targets.length);
    const lengths =
        new Float64Array(targets.length);
    const cursor = offsets.slice();

    const position = (node: number): Point => [
        xy[node * 2]!,
        xy[node * 2 + 1]!,
    ];

    segments.forEach((_, segment) => {
        for (
            let i = shapeOffsets[segment]! + 1;
            i < shapeOffsets[segment + 1]!;
            i++
        ) {
            const a = shapes[i - 1]!;
            const b = shapes[i]!;

            const distance = distanceMeters(
                position(a),
                position(b),
            );

            for (const [from, to] of [[a, b], [b, a]]) {
                const arc = cursor[from!]!++;

                targets[arc] = to!;
                arcSegments[arc] = segment;
                lengths[arc] = distance;
            }
        }
    });

    // Índice espacial compacto para el mapa y el ajuste de puntos.
    const grid = {
        minX,
        minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
    };

    const cells = new Map<number, number[]>();

    segments.forEach((segment, index) => {
        const xs = segment.coordinates.map(
            (point) => point[0],
        );
        const ys = segment.coordinates.map(
            (point) => point[1],
        );

        for (
            let x = Math.floor(Math.min(...xs) / CELL);
            x <= Math.floor(Math.max(...xs) / CELL);
            x++
        ) {
            for (
                let y = Math.floor(Math.min(...ys) / CELL);
                y <= Math.floor(Math.max(...ys) / CELL);
                y++
            ) {
                const key =
                    (y - minY) * grid.width + x - minX;

                if (!cells.has(key)) {
                    cells.set(key, []);
                }

                cells.get(key)!.push(index);
            }
        }
    });

    const cellOffsets = new Uint32Array(
        grid.width * grid.height + 1,
    );

    for (let i = 0; i < cellOffsets.length - 1; i++) {
        cellOffsets[i + 1] =
            cellOffsets[i]!
            + (cells.get(i)?.length ?? 0);
    }

    const cellSegments =
        new Uint32Array(cellOffsets.at(-1)!);

    for (const [cell, values] of cells) {
        cellSegments.set(values, cellOffsets[cell]!);
    }

    const { segments: ignored, ...metadata } = network;

    return {
        format: 1,
        metadata,
        ids: encode(segments.map((segment) => segment.id)),
        nodeIds: encode(nodeIds),
        names: encode(segments.map((segment) => segment.name)),
        ways,
        kinds: kindValues,
        xy: new Float64Array(xy),
        shapes: new Uint32Array(shapes),
        shapeOffsets,
        offsets,
        targets,
        arcSegments,
        lengths,
        grid,
        cellOffsets,
        cellSegments,
    };
}

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

class MinHeap {
    private items: {
        node: number;
        cost: number;
        priority: number;
    }[] = [];

    push(item: {
        node: number;
        cost: number;
        priority: number;
    }) {
        let index = this.items.length;
        this.items.push(item);

        while (index > 0) {
            const parent = (index - 1) >>> 1;

            if (
                this.items[parent]!.priority
                <= item.priority
            ) {
                break;
            }

            this.items[index] = this.items[parent]!;
            index = parent;
        }

        this.items[index] = item;
    }

    pop() {
        const first = this.items[0];
        const last = this.items.pop();

        if (!first || !last || !this.items.length) {
            return first;
        }

        let index = 0;

        while (index * 2 + 1 < this.items.length) {
            let child = index * 2 + 1;

            if (
                child + 1 < this.items.length
                && this.items[child + 1]!.priority
                    < this.items[child]!.priority
            ) {
                child++;
            }

            if (
                this.items[child]!.priority
                >= last.priority
            ) {
                break;
            }

            this.items[index] = this.items[child]!;
            index = child;
        }

        this.items[index] = last;
        return first;
    }
}

export type PedestrianRouteInput = {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    blockedSegmentIds?: string[] | undefined;
    blockedAreas?: Bounds[] | undefined;
    strictOrigin?: boolean | undefined;
};

// El cálculo es síncrono: estos buffers se reutilizan
// después de finalizar cada búsqueda.
const workspaces = new WeakMap<CompactNetwork, {
    distances: Float64Array;
    previous: Int32Array;
    previousSegment: Int32Array;
}>();

export function routeOnCompactNetwork(
    input: PedestrianRouteInput,
    net: CompactNetwork,
) {
    const blocked = new Set<number>();

    for (const id of input.blockedSegmentIds ?? []) {
        const index = segmentIndex(net, id);

        if (index < 0) {
            throw new Error(
                'Un bloqueo pertenece a otra versión de la red.',
            );
        }

        blocked.add(index);
    }

    const areas = input.blockedAreas ?? [];

    const allowed = (
        segment: number,
        a: Point,
        b: Point,
    ) =>
        !blocked.has(segment)
        && (
            !areas.length
            || !routeIntersectsBlockedAreas([a, b], areas)
        );

    const anchor = (point: Point, maxGap: number) => {
        const latGap = 21 / 110000;
        const scale =
            Math.cos(point[1] * Math.PI / 180);
        const lngGap =
            latGap / Math.max(0.001, Math.abs(scale));

        // Esta zona solo sirve para ajustar el punto inicial/final.
        // No limita la búsqueda del recorrido.
        const candidates = segmentIndicesInBounds(net, {
            south: point[1] - latGap,
            north: point[1] + latGap,
            west: point[0] - lngGap,
            east: point[0] + lngGap,
        }).sort((a, b) => a - b);

        let nearest: {
            segment: number;
            from: number;
            to: number;
            point: Point;
            gap: number;
        } | undefined;

        for (const segment of candidates) {
            for (
                let i = net.shapeOffsets[segment]! + 1;
                i < net.shapeOffsets[segment + 1]!;
                i++
            ) {
                const from = net.shapes[i - 1]!;
                const to = net.shapes[i]!;
                const a = pointAt(net, from);
                const b = pointAt(net, to);

                const dx = (b[0] - a[0]) * scale;
                const dy = b[1] - a[1];

                const t = Math.max(
                    0,
                    Math.min(
                        1,
                        (
                            ((point[0] - a[0]) * scale) * dx
                            + (point[1] - a[1]) * dy
                        ) / (dx * dx + dy * dy || 1),
                    ),
                );

                const projected: Point = [
                    a[0] + (b[0] - a[0]) * t,
                    a[1] + (b[1] - a[1]) * t,
                ];

                const gap =
                    distanceMeters(point, projected);

                if (!nearest || gap < nearest.gap) {
                    nearest = {
                        segment,
                        from,
                        to,
                        point: projected,
                        gap,
                    };
                }
            }
        }

        if (!nearest || nearest.gap > maxGap) {
            throw new Error(
                `Elegí un punto sobre la red peatonal resaltada (máximo ${maxGap} m).`,
            );
        }

        return nearest;
    };

    const start = anchor(
        [input.origin.lng, input.origin.lat],
        input.strictOrigin ? 1 : 20,
    );

    const end = anchor(
        [input.destination.lng, input.destination.lat],
        20,
    );

    const count = net.xy.length / 2;
    const origin = count;
    const destination = count + 1;

    const position = (node: number): Point =>
        node === origin
            ? start.point
            : node === destination
              ? end.point
              : pointAt(net, node);

    type Link = {
        to: number;
        length: number;
        segment: number;
    };

    const extra = new Map<number, Link[]>();

    const connect = (
        a: number,
        b: number,
        segment: number,
        forceZero = false,
    ) => {
        const pa = position(a);
        const pb = position(b);

        if (!forceZero && !allowed(segment, pa, pb)) {
            return;
        }

        const length =
            forceZero ? 0 : distanceMeters(pa, pb);

        if (!extra.has(a)) extra.set(a, []);
        if (!extra.has(b)) extra.set(b, []);

        extra.get(a)!.push({
            to: b,
            length,
            segment: forceZero ? -1 : segment,
        });

        extra.get(b)!.push({
            to: a,
            length,
            segment: forceZero ? -1 : segment,
        });
    };

    for (
        const [id, at]
        of [[origin, start], [destination, end]] as const
    ) {
        for (const node of [at.from, at.to]) {
            connect(
                id,
                node,
                at.segment,
                distanceMeters(
                    at.point,
                    position(node),
                ) < 0.01,
            );
        }
    }

    if (
        start.segment === end.segment
        && start.from === end.from
        && start.to === end.to
    ) {
        connect(origin, destination, start.segment);
    }

    let workspace = workspaces.get(net);

    if (!workspace) {
        workspace = {
            distances: new Float64Array(count + 2),
            previous: new Int32Array(count + 2),
            previousSegment: new Int32Array(count + 2),
        };

        workspaces.set(net, workspace);
    }

    const {
        distances,
        previous,
        previousSegment,
    } = workspace;

    distances.fill(Infinity);
    previous.fill(-1);
    previousSegment.fill(-1);
    distances[origin] = 0;

    const pending = new MinHeap();

    // Descuenta la tolerancia de los enlaces de ajuste.
    const heuristic = (node: number) =>
        Math.max(
            0,
            distanceMeters(position(node), end.point) - 0.02,
        );

    pending.push({
        node: origin,
        cost: 0,
        priority: heuristic(origin),
    });

    let reached = false;

    const relax = (
        from: number,
        to: number,
        length: number,
        segment: number,
    ) => {
        const cost = distances[from]! + length;

        if (cost >= distances[to]!) return;

        distances[to] = cost;
        previous[to] = from;
        previousSegment[to] = segment;

        pending.push({
            node: to,
            cost,
            priority: cost + heuristic(to),
        });
    };

    for (
        let item = pending.pop();
        item;
        item = pending.pop()
    ) {
        if (item.cost !== distances[item.node]) {
            continue;
        }

        if (item.node === destination) {
            reached = true;
            break;
        }

        if (item.node < count) {
            for (
                let arc = net.offsets[item.node]!;
                arc < net.offsets[item.node + 1]!;
                arc++
            ) {
                const to = net.targets[arc]!;
                const segment = net.arcSegments[arc]!;

                if (blocked.has(segment)) continue;

                if (
                    areas.length
                    && !allowed(
                        segment,
                        position(item.node),
                        position(to),
                    )
                ) {
                    continue;
                }

                relax(
                    item.node,
                    to,
                    net.lengths[arc]!,
                    segment,
                );
            }
        }

        for (const link of extra.get(item.node) ?? []) {
            relax(
                item.node,
                link.to,
                link.length,
                link.segment,
            );
        }
    }

    if (!reached) {
        throw new Error(
            'No hay conexión peatonal disponible dentro del sandbox con estos bloqueos.',
        );
    }

    const chain: number[] = [];
    const used = new Set<number>();

    for (
        let node = destination;
        node !== -1;
        node = previous[node]!
    ) {
        chain.push(node);

        if (previousSegment[node]! >= 0) {
            used.add(previousSegment[node]!);
        }
    }

    chain.reverse();

    const coordinates = chain
        .map(position)
        .filter(
            (point, index, all) =>
                index === 0
                || distanceMeters(
                    all[index - 1]!,
                    point,
                ) > 0.001,
        );

    if (input.strictOrigin) {
        coordinates[0] = [
            input.origin.lng,
            input.origin.lat,
        ];
    }

    if (coordinates.length === 1) {
        coordinates.push([...coordinates[0]!]);
    }

    const distance = coordinates.reduce(
        (sum, point, index) =>
            index
                ? sum + distanceMeters(
                      coordinates[index - 1]!,
                      point,
                  )
                : sum,
        0,
    );

    return {
        geometry: {
            type: 'LineString' as const,
            coordinates,
        },
        distanceMeters: distance,
        durationSeconds: distance / (5 / 3.6),
        profile: 'foot-walking' as const,
        networkVersion: net.metadata.version,
        provider: 'pedestrian-sandbox' as const,
        segmentIds: [...used].map(
            (segment) => stringAt(net.ids, segment),
        ),
    };
}