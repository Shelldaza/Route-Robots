import {
    expect,
    it,
    vi,
} from 'vitest';

import {
    createRoutingMcpSession,
} from './routing-session';

import type {
    SurfaceIncident,
} from '../types/surfaces';

import type {
    SurfaceImpact,
} from '../../../shared/surfaces';

const context = {
    simulationId: '21bd592c-0da1-43d4-9307-8494429bd15b',
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

const area: SurfaceIncident = {
    id: 'area',
    simulationId: context.simulationId,
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
    createdAt: new Date(),
    startsAt: new Date(),
    expiresAt: new Date(),
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

const surface: SurfaceIncident = {
    ...area,
    id: 'surface',
    surfaceImpact: {
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
    },
};

it('MCP conserva las tres clases y no cierra ambas veredas por una superficie', async () => {
    const calculateRoute = vi.fn().mockResolvedValue({
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
        provider: 'pedestrian-sandbox',
        networkVersion: 'v1',
    });

    const segment: SurfaceIncident = {
        ...area,
        id: 'segment',
        pedestrianImpact: {
            networkVersion: 'v1',
            scope: 'segment',
            segmentIds: ['left'],
            segments: [],
        },
    };

    const session = await createRoutingMcpSession(
        context,
        {
            listActiveIncidents: async () => [
                area,
                segment,
                surface,
                {
                    ...surface,
                    id: 'notice',
                    effect: 'caution',
                },
            ],
            calculateRoute,
        },
    );

    try {
        const result = await session.client.callTool({
            name: 'calcular_desvio',
            arguments: {},
        });

        expect(result.isError)
            .not.toBe(true);

        expect(calculateRoute).toHaveBeenCalledWith({
            origin: context.origin,
            destination: context.destination,
            networkVersion: 'v1',
            strictOrigin: true,
            blockedAreas: [area.blockedArea],
            blockedSegmentIds: ['left'],
            surfaceIncidentIds: ['surface'],
        });

        expect(
            session.getCandidate()?.incidentIds,
        ).toEqual([
            'area',
            'segment',
            'surface',
        ]);
    } finally {
        await session.close();
    }
});