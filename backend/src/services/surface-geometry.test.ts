import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    adaptLine,
    booleanArea,
    makeConstraint,
    offsetArea,
    squareMeters,
    SurfaceGeometryError,
    unionAreas,
} from './surface-geometry';

import {
    contains,
    lineHits,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
} from '../../../shared/surfaces';

const origin: Point = [-77.04, 38.9];

const point = (x: number, y: number): Point =>
    world([x, y], origin);

function rectangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): Area {
    return {
        type: 'MultiPolygon',
        coordinates: [[[
            point(x1, y1),
            point(x2, y1),
            point(x2, y2),
            point(x1, y2),
            point(x1, y1),
        ]]],
    };
}

const sidewalk = rectangle(0, 0, 2, 20);
const obstacle = rectangle(0, 8, 1.2, 9);
const route = [point(1, 1), point(1, 19)];

describe('Superficies peatonales y obstáculos', () => {
    it('recorta el incidente sin incluir la calzada', () => {
        const clipped = booleanArea(
            sidewalk,
            rectangle(-2, 8, 1.2, 9),
            'intersection',
        );

        expect(squareMeters(clipped)).toBeCloseTo(1.2, 2);
        expect(contains(clipped, point(-1, 8.5))).toBe(false);
    });

    it('permite un paso lateral para el robot estrecho', () => {
        const constraint = makeConstraint(
            sidewalk,
            obstacle,
            0.45 / 2 + 0.15,
        );

        const adapted = adaptLine(route, constraint);

        expect(adapted.length).toBeGreaterThan(2);
        expect(lineHits(adapted, constraint.danger)).toBe(false);
        expect(adapted[0]).toEqual(route[0]);
        expect(adapted.at(-1)).toEqual(route.at(-1));
    });

    it('rechaza el mismo paso para el robot ancho', () => {
        expect(() =>
            adaptLine(
                route,
                makeConstraint(
                    sidewalk,
                    obstacle,
                    0.85 / 2 + 0.15,
                ),
            ),
        ).toThrow(SurfaceGeometryError);
    });

    it('combina obstáculos que cierran conjuntamente el paso', () => {
        const combined = unionAreas([
            obstacle,
            rectangle(1.5, 8, 2, 9),
        ]);

        expect(() =>
            adaptLine(
                route,
                makeConstraint(sidewalk, combined, 0.375),
            ),
        ).toThrow();
    });

    it('rodea obstáculos alternados cuando hay conexión', () => {
        const combined = unionAreas([
            rectangle(0, 5, 1.2, 6),
            rectangle(0.8, 12, 2, 13),
        ]);

        const constraint = makeConstraint(
            sidewalk,
            combined,
            0.375,
        );

        expect(
            lineHits(
                adaptLine(route, constraint),
                constraint.danger,
            ),
        ).toBe(false);
    });

    it('respeta los huecos no transitables del polígono', () => {
        const hole = rectangle(0.5, 5, 1.5, 7)
            .coordinates[0]![0]!;

        const withHole: Area = {
            type: 'MultiPolygon',
            coordinates: [[
                sidewalk.coordinates[0]![0]!,
                hole,
            ]],
        };

        const eroded = offsetArea(withHole, -0.1);

        expect(contains(eroded, point(1, 6))).toBe(false);
        expect(contains(eroded, point(0.25, 6))).toBe(true);
    });

    it('no inventa conexiones si OSM queda fuera de la superficie', () => {
        expect(() =>
            adaptLine(
                [point(-0.1, 1), point(-0.1, 19)],
                makeConstraint(sidewalk, obstacle, 0.375),
            ),
        ).toThrow();
    });
});

describe('Reemplazo del recorrido dentro del espacio libre', () => {
    it('rodea el obstáculo aunque el eje intermedio quede cerca del borde', () => {
        const source = [
            point(1, 1),
            point(0.2, 7),
            point(0.2, 10),
            point(1, 19),
        ];

        const constraint = makeConstraint(
            sidewalk,
            rectangle(0, 8, 0.6, 9),
            0.375,
        );

        const result = adaptLine(source, constraint);

        expect(result[0]).toEqual(source[0]);
        expect(result.at(-1)).toEqual(source.at(-1));
        expect(lineHits(result, constraint.danger)).toBe(false);
    });

    it('une superficies contiguas antes de descontar el ancho', () => {
        const source = unionAreas([
            rectangle(0, 0, 2, 8.5),
            rectangle(0, 8.5, 2, 20),
        ]);

        const constraint = makeConstraint(
            source,
            obstacle,
            0.375,
        );

        expect(
            lineHits(
                adaptLine(route, constraint),
                constraint.danger,
            ),
        ).toBe(false);
    });

    it('no conecta superficies separadas por un hueco sin cartografiar', () => {
        const source = unionAreas([
            rectangle(0, 0, 2, 8.5),
            rectangle(0, 8.8, 2, 20),
        ]);

        expect(() =>
            adaptLine(
                route,
                makeConstraint(source, obstacle, 0.375),
            ),
        ).toThrow();
    });
});