import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    boxArea,
    local,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
} from '../../../shared/surfaces';

const mocks = vi.hoisted(() => ({
    context: vi.fn(),
    surfaces: vi.fn(),
    segments: vi.fn(),
}));

vi.mock('./surface-incidents', () => ({
    getSurfaceContext: mocks.context,
}));

vi.mock('./walk-surfaces', () => ({
    queryWalkSurfaces: mocks.surfaces,
}));

vi.mock('./pedestrian-spatial', () => ({
    queryPedestrianSegments: mocks.segments,
}));

vi.mock('./pedestrian-network', () => ({
    pedestrianNetwork: {
        version: 'fixture',
    },
    routeOnPedestrianNetwork: vi.fn(),
}));

import {
    initialSurfaceBox,
    placeIncident,
} from './incident-placement';

const origin: Point = [-77.03, 38.89];

const at = (
    x: number,
    y: number,
): Point => world([x, y], origin);

const input = {
    simulationId:
        '11111111-1111-4111-8111-111111111111',
    networkVersion: 'fixture',
    point: origin,
};

const rectangle = (
    width: number,
    halfLength: number,
    angle = 0,
): Area => boxArea({
    center: origin,
    halfWidth: width,
    halfLength,
    angle,
});

const segment = {
    id: 'edge1',
    wayId: 1,
    from: 'n1',
    to: 'n2',
    kind: 'sidewalk',
    name: 'Vereda',
    coordinates: [
        at(-10, 0),
        at(10, 0),
    ],
};

beforeEach(() => {
    vi.resetAllMocks();

    mocks.context.mockResolvedValue({
        ...input,
        robotId: 'robot',
        widthMeters: 0.6,
        lateralMarginMeters: 0.15,
    });

    mocks.surfaces.mockResolvedValue([
        {
            id: 1,
            code: 1480,
            capturedAt: null,
            geometry: rectangle(20, 2),
        },
    ]);

    mocks.segments.mockReturnValue([segment]);
});

describe('Ubicación unificada de incidentes', () => {
    it('abarca el ancho de la vereda aunque el clic no esté centrado', () => {
        const result = initialSurfaceBox(
            at(0, 1),
            rectangle(20, 2),
            0,
        );

        expect(result.halfWidth).toBe(0.5);
        expect(result.halfLength).toBeCloseTo(2, 2);

        expect(
            local(result.center, origin)[1],
        ).toBeCloseTo(0, 2);
    });

    it('respeta una orientación diagonal', () => {
        const result = initialSurfaceBox(
            origin,
            rectangle(20, 2, Math.PI / 4),
            Math.PI / 4,
        );

        expect(result.angle).toBeCloseTo(Math.PI / 4);
        expect(result.halfLength).toBeCloseTo(2, 2);
    });

    it('se detiene en el primer hueco interior', () => {
        const area = rectangle(20, 2);

        const hole = boxArea({
            center: at(0, 1),
            halfWidth: 2,
            halfLength: 0.5,
            angle: 0,
        });

        area.coordinates[0]!.push(
            hole.coordinates[0]![0]!,
        );

        const result = initialSurfaceBox(
            origin,
            area,
            0,
        );

        expect(result.halfLength).toBeCloseTo(1.25, 2);
    });

    it('elige un área cuando hay una superficie conocida', async () => {
        const result = await placeIncident(input);

        expect(result.mode).toBe('surface');
    });

    it('permite un tramo conocido cuando falta el polígono', async () => {
        mocks.surfaces.mockResolvedValue([]);

        const result = await placeIncident(input);

        if (result.mode !== 'segment') {
            throw new Error('Se esperaba un tramo');
        }

        expect(result.segment.id).toBe('edge1');
    });

    it('no inventa un tramo cuando no hay conexión conocida cercana', async () => {
        mocks.surfaces.mockResolvedValue([]);
        mocks.segments.mockReturnValue([]);

        await expect(
            placeIncident(input),
        ).rejects.toMatchObject({
            statusCode: 422,
        });
    });

    it('no confunde una caída del proveedor con ausencia de cartografía', async () => {
        mocks.surfaces.mockRejectedValue(
            new Error('Proveedor no disponible'),
        );

        await expect(
            placeIncident(input),
        ).rejects.toThrow('Proveedor no disponible');
    });

    it('rechaza una red distinta a la del contexto', async () => {
        await expect(
            placeIncident({
                ...input,
                networkVersion: 'otra',
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(
            mocks.surfaces,
        ).not.toHaveBeenCalled();
    });
});