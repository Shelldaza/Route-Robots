import {
    expect,
    it,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    graph: vi.fn(),
    provider: vi.fn(),
}));

vi.mock('./pedestrian-network', () => ({
    pedestrianNetwork: {
        version: 'v1',
    },
    routeOnPedestrianNetwork: mocks.graph,
}));

vi.mock('../providers/openrouteservice', () => ({
    requestOpenRouteServiceRoute: mocks.provider,
}));

import {
    calculateRoute,
} from './routing';

it('el motor general rechaza superficies pendientes de procesar', async () => {
    await expect(
        calculateRoute({
            origin: {
                lng: -77.04,
                lat: 38.9,
            },
            destination: {
                lng: -77.03,
                lat: 38.9,
            },
            networkVersion: 'v1',
            surfaceIncidentIds: ['surface'],
        }),
    ).rejects.toMatchObject({
        statusCode: 400,
        message:
            'Las restricciones de superficie requieren el motor de superficies.',
    });

    expect(mocks.graph)
        .not.toHaveBeenCalled();

    expect(mocks.provider)
        .not.toHaveBeenCalled();
});