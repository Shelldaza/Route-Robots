// Conserva A*, el ajuste de extremos y la reutilización de buffers de trabajo.
import type { Coordinate as Point, Bounds } from '../../../../shared/contracts/geography';
import type { CompactNetwork } from './model';
import { routeIntersectsBlockedAreas } from '../route-geometry';
import { distanceMeters, pointAt } from './coordinates';
import { segmentIndex, segmentIndicesInBounds } from './spatial';
import { stringAt } from './strings';


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