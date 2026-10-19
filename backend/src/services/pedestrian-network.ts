import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { routeIntersectsBlockedAreas } from './route-geometry';
import { gunzipSync } from 'node:zlib';

type Coordinate = [number, number];
export type PedestrianSegment = {
    id: string; wayId: number; from: string; to: string;
    kind: 'sidewalk' | 'crossing' | 'path'; name: string;
    coordinates: Coordinate[];
};
export type PedestrianNetwork = {
    version: string; name: string; attribution: string; source: string;
    retrievedAt: string;
    bounds: { south: number; west: number; north: number; east: number };
    segments: PedestrianSegment[];
};
// Se distribuye una captura fija: IDs, conectividad y bloqueos no cambian
// durante el escenario. No depende de Overpass en cada clic o replanificación.
export const pedestrianNetwork = JSON.parse(
    gunzipSync(
        readFileSync(
            join(
                __dirname,
                '../data/dc-pedestrian-network.json.gz',
            ),
        ),
    ).toString('utf8'),
) as PedestrianNetwork;

export const pedestrianSelectionSchema = z.object({
    networkVersion: z.string().min(1),
    scope: z.enum(['segment', 'street_section']),
    segmentIds: z.array(z.string().min(1)).min(1).max(30),
}).strict().superRefine((value, context) => {
    if (new Set(value.segmentIds).size !== value.segmentIds.length ||
        (value.scope === 'segment' && value.segmentIds.length !== 1) ||
        (value.scope === 'street_section' && value.segmentIds.length < 2)) {
        context.addIssue({ code: 'custom', message: 'Seleccioná un tramo o varios para ampliar el alcance.' });
    }
});
export type PedestrianImpact = z.infer<typeof pedestrianSelectionSchema> & {
    segments: PedestrianSegment[];
};

export function resolvePedestrianSelection(value: unknown): PedestrianImpact {
    const input = pedestrianSelectionSchema.parse(value);
    if (input.networkVersion !== pedestrianNetwork.version) {
        throw new Error('La red peatonal cambió. Recargá el escenario.');
    }
    const segments = input.segmentIds.map((id) => {
        const segment = pedestrianNetwork.segments.find((item) => item.id === id);
        if (!segment) throw new Error('El tramo seleccionado no pertenece al sandbox.');
        return segment;
    });
    const points = segments.flatMap((segment) => segment.coordinates);
    const first = points[0]!;
    if (points.some((point) => distanceMeters(first, point) > 350)) {
        throw new Error('El alcance debe limitarse a una sección cercana (350 m).');
    }
    return { ...input, segments };
}

export function impactBounds(impact: PedestrianImpact) {
    const points = impact.segments.flatMap((segment) => segment.coordinates);
    // El rectángulo solo permite compatibilidad y ubicación del icono.
    // Nunca se usa para bloquear una selección de tramos.
    return {
        south: Math.min(...points.map((p) => p[1])) - 0.000001,
        west: Math.min(...points.map((p) => p[0])) - 0.000001,
        north: Math.max(...points.map((p) => p[1])) + 0.000001,
        east: Math.max(...points.map((p) => p[0])) + 0.000001,
    };
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
    const rad = Math.PI / 180;
    const dlat = (b[1] - a[1]) * rad;
    const dlon = (b[0] - a[0]) * rad;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) *
        Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

type Arc = { to: string; distance: number; segmentId: string };
type Edge = { from: string; to: string; a: Coordinate; b: Coordinate; segmentId: string };
type Area = { south: number; west: number; north: number; east: number };

export function routeOnPedestrianNetwork(input: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    blockedSegmentIds?: string[] | undefined;
    blockedAreas?: Area[] | undefined;
    strictOrigin?: boolean | undefined;
}, network: PedestrianNetwork = pedestrianNetwork) {
    const blocked = new Set(input.blockedSegmentIds ?? []);
    for (const id of blocked) {
        if (!network.segments.some((segment) => segment.id === id)) {
            throw new Error('Un bloqueo pertenece a otra versión de la red.');
        }
    }
    const graph = new Map<string, Arc[]>();
    const positions = new Map<string, Coordinate>();
    const edges: Edge[] = [];
    const add = (from: string, to: string, a: Coordinate, b: Coordinate, segmentId: string) => {
        if (blocked.has(segmentId) || routeIntersectsBlockedAreas([a, b], input.blockedAreas ?? [])) return;
        const distance = distanceMeters(a, b);
        graph.set(from, [...(graph.get(from) ?? []), { to, distance, segmentId }]);
        graph.set(to, [...(graph.get(to) ?? []), { to: from, distance, segmentId }]);
    };
    for (const segment of network.segments) {
        segment.coordinates.forEach((point, index) => {
            const id = index === 0 ? segment.from : index === segment.coordinates.length - 1
                ? segment.to : `${segment.id}:${index}`;
            positions.set(id, point);
            if (index === 0) return;
            const previousId = index === 1 ? segment.from : `${segment.id}:${index - 1}`;
            const a = segment.coordinates[index - 1]!;
            edges.push({ from: previousId, to: id, a, b: point, segmentId: segment.id });
            add(previousId, id, a, point, segment.id);
        });
    }
    const anchor = (point: Coordinate, maxGap: number) => {
        let nearest: { edge: Edge; point: Coordinate; gap: number } | undefined;
        for (const edge of edges) {
            const scale = Math.cos(point[1] * Math.PI / 180);
            const dx = (edge.b[0] - edge.a[0]) * scale;
            const dy = edge.b[1] - edge.a[1];
            const t = Math.max(0, Math.min(1, (((point[0] - edge.a[0]) * scale) * dx +
                (point[1] - edge.a[1]) * dy) / (dx * dx + dy * dy || 1)));
            const projected: Coordinate = [edge.a[0] + (edge.b[0] - edge.a[0]) * t,
                edge.a[1] + (edge.b[1] - edge.a[1]) * t];
            const gap = distanceMeters(point, projected);
            if (!nearest || gap < nearest.gap) nearest = { edge, point: projected, gap };
        }
        if (!nearest || nearest.gap > maxGap) {
            throw new Error(`Elegí un punto sobre la red peatonal resaltada (máximo ${maxGap} m).`);
        }
        return nearest;
    };
    const start = anchor([input.origin.lng, input.origin.lat], input.strictOrigin ? 1 : 20);
    const end = anchor([input.destination.lng, input.destination.lat], 20);
    const attach = (id: string, at: typeof start) => {
        positions.set(id, at.point);
        // En un nodo compartido se puede salir por un tramo libre aunque
        // el tramo vecino esté cerrado. En su interior no se salta a otro.
        for (const [node, position] of [[at.edge.from, at.edge.a], [at.edge.to, at.edge.b]] as const) {
            if (distanceMeters(at.point, position) < 0.01) {
                graph.set(id, [...(graph.get(id) ?? []), { to: node, distance: 0, segmentId: '' }]);
                graph.set(node, [...(graph.get(node) ?? []), { to: id, distance: 0, segmentId: '' }]);
            } else add(id, node, at.point, position, at.edge.segmentId);
        }
    };
    attach('@origin', start); attach('@destination', end);
    if (start.edge.from === end.edge.from && start.edge.to === end.edge.to &&
        start.edge.segmentId === end.edge.segmentId) {
        add('@origin', '@destination', start.point, end.point, start.edge.segmentId);
    }
    const distances = new Map<string, number>([['@origin', 0]]);
    const previous = new Map<string, { node: string; segmentId: string }>();
    const pending = new Set(['@origin']); const visited = new Set<string>();
    while (pending.size) {
        const node = [...pending].reduce((a, b) => distances.get(a)! <= distances.get(b)! ? a : b);
        pending.delete(node);
        if (node === '@destination') break;
        visited.add(node);
        for (const arc of graph.get(node) ?? []) {
            if (visited.has(arc.to)) continue;
            const cost = distances.get(node)! + arc.distance;
            if (cost < (distances.get(arc.to) ?? Infinity)) {
                distances.set(arc.to, cost); previous.set(arc.to, { node, segmentId: arc.segmentId });
                pending.add(arc.to);
            }
        }
    }
    if (!distances.has('@destination')) {
        throw new Error('No hay conexión peatonal disponible dentro del sandbox con estos bloqueos.');
    }
    const chain = ['@destination']; const used = new Set<string>();
    while (chain[0] !== '@origin') {
        const link = previous.get(chain[0]!)!;
        if (link.segmentId) used.add(link.segmentId);
        chain.unshift(link.node);
    }
    const coordinates = chain.map((id) => positions.get(id)!).filter((point, index, all) =>
        index === 0 || distanceMeters(all[index - 1]!, point) > 0.001);
    if (input.strictOrigin && start.gap <= 1) coordinates[0] = [input.origin.lng, input.origin.lat];
    if (coordinates.length === 1) coordinates.push([...coordinates[0]!]);
    const distance = coordinates.reduce((sum, p, i) => i ? sum + distanceMeters(coordinates[i - 1]!, p) : 0, 0);
    return {
        geometry: { type: 'LineString' as const, coordinates },
        distanceMeters: distance, durationSeconds: distance / (5 / 3.6),
        profile: 'foot-walking' as const, networkVersion: network.version,
        provider: 'pedestrian-sandbox' as const, segmentIds: [...used],
    };
}
