import { describe, expect, it } from 'vitest';
import { routeIntersectsBlockedAreas } from './route-geometry';

const area = {
    south: 1,
    west: 1,
    north: 3,
    east: 3,
};

type GeometryCase = [
    string,
    [number, number][],
    boolean,
];

const cases: GeometryCase[] = [
    [
        'detecta un cruce aunque ambos extremos estén afuera',
        [[0, 2], [4, 2]],
        true,
    ],
    [
        'detecta un cruce vertical',
        [[2, 0], [2, 4]],
        true,
    ],
    [
        'detecta un segmento dentro del bloqueo',
        [[1.5, 1.5], [2.5, 2.5]],
        true,
    ],
    [
        'considera bloqueado un recorrido sobre el borde',
        [[0, 1], [4, 1]],
        true,
    ],
    [
        'considera bloqueado un recorrido que toca una esquina',
        [[0, 2], [2, 0]],
        true,
    ],
    [
        'permite un recorrido paralelo por fuera',
        [[0, 0], [4, 0]],
        false,
    ],
    [
        'permite rodear el bloqueo',
        [[0, 2], [0, 4], [4, 4], [4, 2]],
        false,
    ],
    [
        'detecta un segmento de longitud cero dentro del bloqueo',
        [[2, 2], [2, 2]],
        true,
    ],
    [
        'permite un segmento de longitud cero fuera del bloqueo',
        [[0, 0], [0, 0]],
        false,
    ],
];

describe('Intersección entre rutas y bloqueos', () => {
    it.each(cases)('%s', (_name, coordinates, expected) => {
        expect(
            routeIntersectsBlockedAreas(coordinates, [area]),
        ).toBe(expected);
    });

    it('permite una ruta cuando no hay bloqueos', () => {
        expect(
            routeIntersectsBlockedAreas(
                [[0, 2], [4, 2]],
                [],
            ),
        ).toBe(false);
    });

    it('comprueba todos los bloqueos', () => {
        const distantArea = {
            south: 10,
            west: 10,
            north: 12,
            east: 12,
        };

        expect(
            routeIntersectsBlockedAreas(
                [[0, 2], [4, 2]],
                [distantArea, area],
            ),
        ).toBe(true);
    });
});