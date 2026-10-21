import {
    expect,
    it,
    vi,
} from 'vitest';

// El backend prueba el contrato compartido sin depender del frontend.
import {
    replanningEndpoints,
} from '../../../shared/routing/replanning-endpoints';

import {
    contains,
    lineHits,
    world,
} from '../../../shared/surfaces';

import type {
    Area,
    Point,
    SurfaceImpact,
} from '../../../shared/surfaces';

import type {
    SurfaceContext,
    SurfaceIncident,
} from './surface-incidents';

import {
    pedestrianNetwork,
    routeOnPedestrianNetwork,
    distanceMeters,
} from './pedestrian-network';

import type {
    PedestrianNetwork,
} from './pedestrian-network';

vi.mock('./surface-incidents', () => ({
    robotRadius: () => 0.375,
}));

vi.mock('./routing', async () => {
    const actual = await vi.importActual<
        typeof import('./routing')
    >('./routing');

    return {
        ...actual,

        calculateRoute: (
            input: Parameters<
                typeof routeOnPedestrianNetwork
            >[0],
        ) => routeOnPedestrianNetwork(input, network),
    };
});

import {
    calculateSurfaceRoute,
} from './surface-routing';

const reference: Point = [-77.04, 38.9];

const point = (x: number, y: number): Point =>
    world([x, y], reference);

function rectangle(
    x: number,
    y: number,
    width: number,
    height: number,
): Area {
    return {
        type: 'MultiPolygon',
        coordinates: [[[
            point(x, y),
            point(x + width, y),
            point(x + width, y + height),
            point(x, y + height),
            point(x, y),
        ]]],
    };
}

// Red mínima: permite comprobar los extremos sin depender de la red completa.
const network: PedestrianNetwork = {
    ...pedestrianNetwork,
    version: 'endpoints-test',

    segments: [{
        id: 'ab',
        from: 'a',
        to: 'b',
        wayId: 1,
        kind: 'sidewalk',
        name: 'Prueba',

        coordinates: [
            point(0, 1),
            point(110, 1),
        ],
    }],
};

const start = point(10, 1);

// El clic queda dos metros fuera del eje peatonal.
const clickedDestination = point(100, 3);

const context: SurfaceContext = {
    simulationId: 'sim',
    robotId: 'robot',
    networkVersion: network.version,
    widthMeters: 0.45,
    lateralMarginMeters: 0.15,
};

const impact: SurfaceImpact = {
    geometry: rectangle(50, 0, 1, 1.2),
    collisionGeometry: rectangle(50, 0, 1, 1.2),

    surfaces: [{
        id: 1,
        code: 1480,
        capturedAt: null,
        geometry: rectangle(0, 0, 110, 2),
    }],

    segmentIds: ['ab'],
    source: 'fixture',
    retrievedAt: '2026-10-20',

    box: {
        center: point(50.5, 0.6),
        halfWidth: 0.5,
        halfLength: 0.6,
        angle: 0,
    },

    unknown: false,
};

// Un bloqueo obliga a validar el rodeo y la conservación de los extremos.
const incident = {
    id: 'report',
    effect: 'blockage',
    surfaceImpact: impact,
} as SurfaceIncident;

function initialRoute() {
    return routeOnPedestrianNetwork(
        {
            origin: {
                lng: start[0],
                lat: start[1],
            },
            destination: {
                lng: clickedDestination[0],
                lat: clickedDestination[1],
            },
            strictOrigin: true,
        },
        network,
    );
}

it('reproduce el rechazo al reenviar el clic original', async () => {
    const route = initialRoute();

    expect(
        distanceMeters(
            route.geometry.coordinates.at(-1)!,
            clickedDestination,
        ),
    ).toBeGreaterThan(1.9);

    await expect(
        calculateSurfaceRoute(
            {
                origin: {
                    lng: start[0],
                    lat: start[1],
                },
                destination: {
                    lng: clickedDestination[0],
                    lat: clickedDestination[1],
                },
                strictOrigin: true,
            },
            context,
            [incident],
        ),
    ).rejects.toThrow(
        'no conserva los extremos',
    );
});

it('rodea el obstáculo conservando el destino aceptado', async () => {
    const initial = initialRoute();

    const endpoints = replanningEndpoints(
        initial.geometry.coordinates,
        start,
    );

    const result = await calculateSurfaceRoute(
        {
            ...endpoints,
            strictOrigin: true,
        },
        context,
        [incident],
    );

    expect(
        distanceMeters(
            result.geometry.coordinates[0]!,
            start,
        ),
    ).toBeLessThan(0.02);

    expect(
        distanceMeters(
            result.geometry.coordinates.at(-1)!,
            initial.geometry.coordinates.at(-1)!,
        ),
    ).toBeLessThan(0.02);

    expect(
        result.geometry.coordinates.length,
    ).toBeGreaterThan(2);

    expect(
        lineHits(
            result.geometry.coordinates,
            impact.geometry,
        ),
    ).toBe(false);

    expect(
        contains(
            impact.surfaces[0]!.geometry,
            result.geometry.coordinates[1]!,
        ),
    ).toBe(true);
});

it('conserva la posición actual del robot en el nuevo pedido', () => {
    const route = initialRoute();
    const current = point(30, 1);

    const endpoints = replanningEndpoints(
        route.geometry.coordinates,
        current,
    );

    expect(endpoints.origin).toEqual({
        lng: current[0],
        lat: current[1],
    });
});

it('rechaza un recorrido sin un destino válido', () => {
    expect(() =>
        replanningEndpoints([], null),
    ).toThrow();

    expect(() =>
        replanningEndpoints(
            [start, [NaN, 38.9]],
            start,
        ),
    ).toThrow();
});