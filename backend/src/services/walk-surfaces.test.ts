import {
    afterEach,
    expect,
    it,
    vi,
} from 'vitest';

vi.mock('./routing', () => ({
    RoutingError: class extends Error {
        constructor(
            public statusCode: number,
            message: string,
        ) {
            super(message);
        }
    },
}));

const bounds = {
    south: 38.9,
    north: 38.9001,
    west: -77.04,
    east: -77.0399,
};

const feature = (id: number, code = 1480) => ({
    properties: {
        OBJECTID: id,
        FEATURECODE: code,
        CAPTUREYEAR: 1743048000000,
    },
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [-77.04, 38.9],
            [-77.0399, 38.9],
            [-77.0399, 38.9001],
            [-77.04, 38.9],
        ]],
    },
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

it('separa la capa actual y la captura 2023 en la caché', async () => {
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(
            new Response(JSON.stringify({
                features: [feature(1)],
            })),
        )
        .mockResolvedValueOnce(
            new Response(JSON.stringify({
                features: [feature(2)],
            })),
        );

    vi.stubGlobal('fetch', fetchMock);

    const { queryWalkSurfaces } =
        await import('./walk-surfaces.js');

    expect(
        (await queryWalkSurfaces(bounds))[0]!.id,
    ).toBe(1);

    expect(
        (await queryWalkSurfaces(bounds, 'archive'))[0]!.id,
    ).toBe(2);

    expect(
        (await queryWalkSurfaces(bounds))[0]!.id,
    ).toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(
        String(fetchMock.mock.calls[0]![0]),
    ).toContain('Transportation_WebMercator');

    expect(
        String(fetchMock.mock.calls[1]![0]),
    ).toContain('Planimetrics_2023');
});

it('solicita coordenadas geográficas y categorías de inspección', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
            features: [feature(1, 1482)],
        })),
    );

    vi.stubGlobal('fetch', fetchMock);

    const { queryWalkSurfaces } =
        await import('./walk-surfaces.js');

    expect(
        (await queryWalkSurfaces(bounds))[0]!.code,
    ).toBe(1482);

    const url = new URL(fetchMock.mock.calls[0]![0]);

    expect(url.searchParams.get('outSR')).toBe('4326');

    expect(
        url.searchParams.get('where'),
    ).toContain('1481,1482');
});

it('rechaza una vista amplia antes de descargar datos', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const { queryWalkSurfaces } =
        await import('./walk-surfaces.js');

    await expect(
        queryWalkSurfaces({
            ...bounds,
            north: 39,
        }),
    ).rejects.toMatchObject({
        statusCode: 400,
    });

    expect(fetchMock).not.toHaveBeenCalled();
});

it('rechaza respuestas truncadas del proveedor', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                features: [],
                properties: {
                    exceededTransferLimit: true,
                },
            })),
        ),
    );

    const { queryWalkSurfaces } =
        await import('./walk-surfaces.js');

    await expect(
        queryWalkSurfaces(bounds),
    ).rejects.toMatchObject({
        statusCode: 413,
    });
});

it('no fabrica veredas si el proveedor no está disponible', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(
            new Error('network'),
        ),
    );

    const { queryWalkSurfaces } =
        await import('./walk-surfaces.js');

    await expect(
        queryWalkSurfaces(bounds),
    ).rejects.toMatchObject({
        statusCode: 502,
    });
});