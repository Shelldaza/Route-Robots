// Preparación offline de columnas, grafo e índice espacial.
import type { PedestrianNetwork } from '../../../../shared/contracts/pedestrian';
import type { Coordinate as Point } from '../../../../shared/contracts/geography';
import { CELL, kinds } from './model';
import type { CompactNetwork } from './model';
import { encode } from './strings';
import { distanceMeters } from './coordinates';


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