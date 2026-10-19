import { describe, expect, it } from 'vitest';
import {
    pedestrianNetwork, resolvePedestrianSelection, routeOnPedestrianNetwork,
} from './pedestrian-network';
import type { PedestrianNetwork, PedestrianSegment } from './pedestrian-network';

const points: Record<string, [number, number]> = {
    a: [0, 0], b: [0.001, 0], c: [0.002, 0],
    f: [0, 0.0002], e: [0.001, 0.0002], d: [0.002, 0.0002],
};
function edge(from: string, to: string, kind: PedestrianSegment['kind'] = 'sidewalk'): PedestrianSegment {
    return { id: from + to, from, to, kind, wayId: 1, name: '', coordinates: [points[from]!, points[to]!] };
}
const network: PedestrianNetwork = {
    ...pedestrianNetwork, version: 'test',
    segments: [edge('a', 'b'), edge('b', 'c'), edge('f', 'e'), edge('e', 'd'),
    edge('a', 'f', 'crossing'), edge('c', 'd', 'crossing')],
};
const origin = { lat: 0, lng: 0.0008 };
const destination = { lat: 0, lng: 0.002 };

describe('Red peatonal y desvíos', () => {
    it('reutiliza el grafo sin conservar bloqueos de una búsqueda anterior', () => {
        const detour = routeOnPedestrianNetwork(
            {
                origin,
                destination,
                blockedSegmentIds: ['bc'],
                strictOrigin: true,
            },
            network,
        );

        const free = routeOnPedestrianNetwork(
            {
                origin,
                destination,
                strictOrigin: true,
            },
            network,
        );

        expect(detour.segmentIds).not.toContain('bc');
        expect(free.segmentIds).toContain('bc');

        expect(free.distanceMeters)
            .toBeLessThan(detour.distanceMeters);
    });
    it('no cruza de vereda por una conexión que no está mapeada', () => {
        const route = routeOnPedestrianNetwork({
            origin: { lat: 0, lng: 0.001 },
            destination: { lat: 0.0002, lng: 0.001 }
        }, network);
        expect(route.distanceMeters).toBeGreaterThan(200);
        expect(route.segmentIds.some((id) => id === 'af' || id === 'cd')).toBe(true);
    });
    it('retrocede por el tramo recorrido sin cambiar la posición inicial', () => {
        const route = routeOnPedestrianNetwork({ origin, destination, blockedSegmentIds: ['bc'], strictOrigin: true }, network);
        expect(route.geometry.coordinates[0]).toEqual([origin.lng, origin.lat]);
        expect(route.geometry.coordinates[1]).toEqual(points.a);
        expect(route.segmentIds).not.toContain('bc');
        expect(route.segmentIds).toContain('af');
        expect(route.segmentIds).toContain('cd');
        expect(route.distanceMeters).toBeGreaterThan(300);
    });
    it('cerrar una vereda no cierra la de enfrente', () => {
        const route = routeOnPedestrianNetwork({
            origin: { lat: 0.0002, lng: 0.0005 },
            destination: { lat: 0.0002, lng: 0.0018 }, blockedSegmentIds: ['ab', 'bc']
        }, network);
        expect(route.segmentIds).toEqual(expect.arrayContaining(['fe', 'ed']));
        expect(route.distanceMeters).toBeLessThan(160);
    });
    it('no ajusta un origen bloqueado a la vereda libre de enfrente', () => {
        expect(() => routeOnPedestrianNetwork({
            origin, destination,
            blockedSegmentIds: ['ab'], strictOrigin: true
        }, network)).toThrow('No hay conexión');
    });
    it('si se cierran también los cruces, informa que no hay conexión en el sandbox', () => {
        expect(() => routeOnPedestrianNetwork({
            origin, destination,
            blockedSegmentIds: ['bc', 'af', 'cd']
        }, network)).toThrow('dentro del sandbox');
    });
    it('rechaza orígenes lejanos y bloqueos de otra red', () => {
        expect(() => routeOnPedestrianNetwork({ origin: { lat: 0.01, lng: 0.01 }, destination }, network)).toThrow('20 m');
        expect(() => routeOnPedestrianNetwork({ origin, destination, blockedSegmentIds: ['inventado'] }, network)).toThrow('otra versión');
    });
    it('el modo estricto rechaza un ajuste de varios metros', () => {
        expect(() => routeOnPedestrianNetwork({
            origin: { ...origin, lat: 0.00003 },
            destination, strictOrigin: true
        }, network)).toThrow('1 m');
    });
    it('mantiene distancias y coordenadas en rutas sobre la misma arista', () => {
        const route = routeOnPedestrianNetwork({
            origin: { lat: 0, lng: 0.0002 },
            destination: { lat: 0, lng: 0.0007 }
        }, network);
        expect(route.distanceMeters).toBeCloseTo(55.597, 1);
        expect(route.geometry.coordinates).toHaveLength(2);
    });
});

describe('Captura real del sandbox', () => {
    it('contiene veredas y cruces con extremos conectados y geometrías válidas', () => {
        const ids = new Set<string>();

        const positions = new Map<
            string,
            readonly [number, number]
        >();

        const examples: string[] = [];

        let issueCount = 0;
        let crossingCount = 0;

        function report(message: string) {
            issueCount += 1;

            // Limita el tamaño del diagnóstico si hay muchos errores.
            if (examples.length < 10) {
                examples.push(message);
            }
        }

        for (const segment of pedestrianNetwork.segments) {
            if (ids.has(segment.id)) {
                report(`ID repetido: ${segment.id}`);
            }

            ids.add(segment.id);

            if (segment.kind === 'crossing') {
                crossingCount += 1;
            }

            if (segment.coordinates.length < 2) {
                report(
                    `Tramo sin suficientes coordenadas: ${segment.id}`,
                );
                continue;
            }

            const endpoints = [
                [segment.from, segment.coordinates[0]!],
                [segment.to, segment.coordinates.at(-1)!],
            ] as const;

            for (const [id, coordinate] of endpoints) {
                const previous = positions.get(id);

                if (
                    previous &&
                    (
                        previous[0] !== coordinate[0] ||
                        previous[1] !== coordinate[1]
                    )
                ) {
                    report(
                        `Nodo con posiciones diferentes: ${id}`,
                    );
                } else if (!previous) {
                    positions.set(id, coordinate);
                }
            }
        }

        expect(
            pedestrianNetwork.segments.length,
        ).toBeGreaterThan(0);

        expect(crossingCount).toBeGreaterThan(100);

        expect({
            issueCount,
            examples,
        }).toEqual({
            issueCount: 0,
            examples: [],
        });
    });
    it('resuelve IDs del servidor e impide geometrías o versiones inventadas', () => {
        const segment = pedestrianNetwork.segments[0]!;
        expect(resolvePedestrianSelection({
            networkVersion: pedestrianNetwork.version,
            scope: 'segment', segmentIds: [segment.id]
        }).segments[0]).toEqual(segment);
        expect(() => resolvePedestrianSelection({
            networkVersion: 'vieja',
            scope: 'segment', segmentIds: [segment.id]
        })).toThrow('cambió');
        expect(() => resolvePedestrianSelection({
            networkVersion: pedestrianNetwork.version,
            scope: 'segment', segmentIds: ['inventado']
        })).toThrow('sandbox');
        expect(() => resolvePedestrianSelection({
            networkVersion: pedestrianNetwork.version,
            scope: 'segment', segmentIds: [segment.id, segment.id]
        })).toThrow();
    });
});
