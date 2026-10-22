import {
    expect,
    it,
} from 'vitest';

import {
    toRoutingIncidents,
    buildRestrictedRouteRequest,
    consumeSurfaceRestrictions,
    validateRestrictedRoute,
} from './routing-restrictions';

import type {
    SurfaceIncident,
} from '../types/surfaces';

import type {
    SurfaceImpact,
} from '../../../shared/surfaces';

import type {
    CalculatedRoute,
} from '../types/routing';

const context = {
    simulationId: 'sim',
    networkVersion: 'v1',
    origin: {
        lng: -77.04,
        lat: 38.9,
    },
    destination: {
        lng: -77.03,
        lat: 38.9,
    },
};

const robot = {
    ...context,
    robotId: 'robot',
    widthMeters: 0.45,
    lateralMarginMeters: 0.15,
};

const area: SurfaceIncident = {
    id: 'area',
    simulationId: 'sim',
    type: 'roadworks',
    source: 'manual',
    description: 'Obra',
    effect: 'blockage',
    reporterName: 'Usuario',
    blockedArea: {
        west: -77.036,
        south: 38.901,
        east: -77.035,
        north: 38.902,
    },
    createdAt: new Date('2026-10-21T00:00:00Z'),
    startsAt: new Date('2026-10-21T00:00:00Z'),
    expiresAt: new Date('2026-10-21T00:20:00Z'),
};

const segment: SurfaceIncident = {
    ...area,
    id: 'segment',
    pedestrianImpact: {
        networkVersion: 'v1',
        scope: 'segment',
        segmentIds: ['left-sidewalk'],
        segments: [],
    },
};

const geometry: SurfaceImpact['geometry'] = {
    type: 'MultiPolygon',
    coordinates: [[[
        [-77.036, 38.901],
        [-77.035, 38.901],
        [-77.035, 38.902],
        [-77.036, 38.902],
        [-77.036, 38.901],
    ]]],
};

const impact: SurfaceImpact = {
    geometry,
    collisionGeometry: geometry,
    surfaces: [],
    segmentIds: ['near-left', 'near-right'],
    source: 'official',
    retrievedAt: '2026-10-21',
    box: {
        center: [-77.0355, 38.9015],
        halfWidth: 1,
        halfLength: 1,
        angle: 0,
    },
    unknown: false,
};

// Tiene referencias de tramos, pero su alcance real es de superficie.
const surface: SurfaceIncident = {
    ...segment,
    id: 'surface',
    surfaceImpact: impact,
};

const route: CalculatedRoute = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [-77.04, 38.9],
            [-77.03, 38.9],
        ],
    },
    distanceMeters: 800,
    durationSeconds: 576,
    profile: 'foot-walking',
    networkVersion: 'v1',
    provider: 'pedestrian-sandbox',
    segmentIds: ['right-sidewalk'],
};

it('distingue área, tramo y superficie sin fabricar impactos peatonales', () => {
    const result = toRoutingIncidents(
        [area, segment, surface],
        'v1',
    );

    expect(
        result.map((incident) => incident.restriction),
    ).toEqual([
        {
            kind: 'area',
            bounds: area.blockedArea,
        },
        {
            kind: 'segments',
            networkVersion: 'v1',
            segmentIds: ['left-sidewalk'],
        },
        {
            kind: 'surface',
            networkVersion: 'v1',
        },
    ]);

    for (const incident of result) {
        expect(incident)
            .not.toHaveProperty('pedestrianImpact');
    }

    expect(result[2])
        .not.toHaveProperty('surfaceImpact');
});

it('las precauciones y avisos no se convierten en restricciones', () => {
    expect(
        toRoutingIncidents(
            [
                {
                    ...surface,
                    effect: 'caution',
                },
                {
                    ...segment,
                    effect: 'informational',
                },
            ],
            'v1',
        ),
    ).toEqual([]);
});

it('envía a cada motor únicamente el alcance que corresponde', () => {
    const restrictions = toRoutingIncidents(
        [area, segment, surface],
        'v1',
    );

    expect(
        buildRestrictedRouteRequest(
            context,
            restrictions,
        ),
    ).toEqual({
        origin: context.origin,
        destination: context.destination,
        networkVersion: 'v1',
        strictOrigin: true,
        blockedAreas: [area.blockedArea],
        blockedSegmentIds: ['left-sidewalk'],
        surfaceIncidentIds: ['surface'],
    });
});

it('un cierre por tramo no puede representarse mediante una lista vacía', () => {
    expect(() =>
        toRoutingIncidents(
            [{
                ...segment,
                pedestrianImpact: {
                    ...segment.pedestrianImpact!,
                    segmentIds: [],
                },
            }],
            'v1',
        )
    ).toThrow('debe identificar');
});

it('no permite convertir una superficie en un bloqueo del proveedor general', () => {
    expect(() =>
        buildRestrictedRouteRequest(
            {
                simulationId: 'sim',
                origin: context.origin,
                destination: context.destination,
            },
            toRoutingIncidents([surface], 'v1'),
        )
    ).toThrow('requieren');
});

it('rechaza restricciones de otra versión de red', () => {
    expect(() =>
        buildRestrictedRouteRequest(
            context,
            toRoutingIncidents(
                [{
                    ...segment,
                    pedestrianImpact: {
                        ...segment.pedestrianImpact!,
                        networkVersion: 'v2',
                    },
                }],
                'v1',
            ),
        )
    ).toThrow('otra versión');
});

it('permite la vereda opuesta y rechaza la que fue cerrada', () => {
    const restrictions = toRoutingIncidents(
        [segment],
        'v1',
    );

    expect(() =>
        validateRestrictedRoute(
            route,
            restrictions,
            context,
        )
    ).not.toThrow();

    expect(() =>
        validateRestrictedRoute(
            {
                ...route,
                segmentIds: ['left-sidewalk'],
            },
            restrictions,
            context,
        )
    ).toThrow('tramo peatonal bloqueado');
});

it('elimina las referencias solo después de comprobar los incidentes de superficie', () => {
    const request = buildRestrictedRouteRequest(
        context,
        toRoutingIncidents([surface], 'v1'),
    );

    expect(
        consumeSurfaceRestrictions(
            request,
            robot,
            [surface],
        ),
    ).toEqual({
        origin: context.origin,
        destination: context.destination,
        networkVersion: 'v1',
        strictOrigin: true,
        blockedAreas: [],
        blockedSegmentIds: [],
    });

    expect(() =>
        consumeSurfaceRestrictions(
            request,
            robot,
            [],
        )
    ).toThrow('cambiaron');
});

it('la validación final sigue rechazando las áreas bloqueadas', () => {
    const crossing = {
        ...area,
        blockedArea: {
            west: -77.036,
            south: 38.899,
            east: -77.035,
            north: 38.901,
        },
    };

    expect(() =>
        validateRestrictedRoute(
            route,
            toRoutingIncidents([crossing]),
            context,
        )
    ).toThrow('no evita');
});