import {
    expect,
    it,
    vi,
} from 'vitest';

import {
    world,
} from '../../../shared/surfaces';

import type {
    Point,
    WalkSurface,
} from '../../../shared/surfaces';

import type {
    PedestrianSegment,
} from './pedestrian-network';

// Cada prueba proporciona su propio grafo pequeño.
// No necesita cargar la captura completa de Washington.
vi.mock('./pedestrian-spatial', () => ({
    queryPedestrianSegments: vi.fn(),
}));

import {
    hasPedestrianPathProof,
} from './pedestrian-path-proof';

const point = (
    x: number,
    y: number,
): Point => world(
    [x, y],
    [-77.04, 38.9],
);

// Vereda de cuatro metros de ancho y veinte de largo.
const surface: WalkSurface = {
    id: 1,
    code: 1480,
    capturedAt: null,
    geometry: {
        type: 'MultiPolygon',
        coordinates: [[[
            point(0, 0),
            point(4, 0),
            point(4, 20),
            point(0, 20),
            point(0, 0),
        ]]],
    },
};

function edge(
    id: string,
    from: string,
    to: string,
    a: Point,
    b: Point,
): PedestrianSegment {
    return {
        id,
        from,
        to,
        wayId: 1,
        kind: 'sidewalk',
        name: '',
        coordinates: [a, b],
    };
}

it(
    'acepta una trayectoria contenida en una superficie apta para el ancho',
    () => {
        expect(
            hasPedestrianPathProof(
                [
                    point(1, 1),
                    point(3, 19),
                ],
                [surface],
                0.4,
                () => [],
            ),
        ).toBe(true);
    },
);

it(
    'rechaza una trayectoria inventada fuera del grafo y las superficies',
    () => {
        expect(
            hasPedestrianPathProof(
                [
                    point(1, 1),
                    point(10, 10),
                    point(1, 19),
                ],
                [surface],
                0.4,
                () => [],
            ),
        ).toBe(false);
    },
);

it(
    'permite continuar por una arista conocida aunque falte un polígono',
    () => {
        const a = point(0, 0);
        const b = point(0, 20);

        expect(
            hasPedestrianPathProof(
                [a, b],
                [],
                0.4,
                () => [
                    edge('ab', 'a', 'b', a, b),
                ],
            ),
        ).toBe(true);
    },
);

it(
    'permite un giro entre aristas conectadas',
    () => {
        const a = point(0, 0);
        const b = point(0, 10);
        const c = point(10, 10);

        const edges = [
            edge('ab', 'a', 'b', a, b),
            edge('bc', 'b', 'c', b, c),
        ];

        expect(
            hasPedestrianPathProof(
                [a, b, c],
                [],
                0.4,
                () => edges,
            ),
        ).toBe(true);
    },
);

it(
    'rechaza un salto entre ejes que se cruzan sin un nodo compartido',
    () => {
        const a = point(0, 0);
        const b = point(0, 10);
        const c = point(10, 10);

        // Coinciden visualmente en b, pero el segundo tramo
        // pertenece a otro nodo: no existe conexión declarada.
        const edges = [
            edge('ab', 'a', 'b', a, b),
            edge('cd', 'other', 'c', b, c),
        ];

        expect(
            hasPedestrianPathProof(
                [a, b, c],
                [],
                0.4,
                () => edges,
            ),
        ).toBe(false);
    },
);

it(
    'el ancho del robot impide usar una superficie demasiado angosta',
    () => {
        expect(
            hasPedestrianPathProof(
                [
                    point(1, 1),
                    point(1, 19),
                ],
                [surface],
                2.1,
                () => [],
            ),
        ).toBe(false);
    },
);

it(
    'no confunde extremos válidos con una trayectoria completamente transitable',
    () => {
        // El hueco representa una zona que no pertenece
        // a la superficie peatonal.
        const withHole: WalkSurface = {
            ...surface,
            geometry: {
                type: 'MultiPolygon',
                coordinates: [[
                    surface.geometry.coordinates[0]![0]!,
                    [
                        point(1, 8),
                        point(1, 12),
                        point(3, 12),
                        point(3, 8),
                        point(1, 8),
                    ],
                ]],
            },
        };

        expect(
            hasPedestrianPathProof(
                [
                    point(2, 1),
                    point(2, 19),
                ],
                [withHole],
                0.4,
                () => [],
            ),
        ).toBe(false);
    },
);