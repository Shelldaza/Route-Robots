import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';

import type {
    Incident,
} from '../types/incidents';

import type {
    CalculatedRoute,
} from '../types/routing';

import {
    createRoutingMcpSession,
} from '../mcp/routing-session';

import {
    incidentFingerprint,
} from '../services/routing-evaluation';

const { messages } = vi.hoisted(() => ({
    messages: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = {
            create: messages,
        };
    },
}));

import {
    replanRoute,
} from './replanning';

const context = {
    simulationId:
        '21bd592c-0da1-43d4-9307-8494429bd15b',

    origin: {
        lat: 38.9072,
        lng: -77.0369,
    },

    destination: {
        lat: 38.91,
        lng: -77.03,
    },

    scenarioTime:
        '2026-10-17T12:05:00.000Z',
};

const incident: Incident = {
    id: 'f88bbd1b-dc80-4339-b734-a82b717d51db',
    simulationId: context.simulationId,
    type: 'blockage',
    effect: 'blockage',
    description: 'Obra.',
    reporterName: 'Robot',
    source: 'simulation',

    createdAt:
        new Date('2026-10-17T12:00:00Z'),

    startsAt:
        new Date('2026-10-17T12:00:00Z'),

    expiresAt:
        new Date('2026-10-17T12:15:00Z'),

    blockedArea: {
        south: 38.908,
        west: -77.035,
        north: 38.909,
        east: -77.034,
    },
};

// Esta geometría evita el rectángulo del incidente.
const route: CalculatedRoute = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [-77.0369, 38.9072],
            [-77.0369, 38.91],
            [-77.03, 38.91],
        ],
    },

    distanceMeters: 1100,
    durationSeconds: 800,
    profile: 'foot-walking',
};

function services() {
    return {
        listActiveIncidents: vi.fn()
            .mockResolvedValue([
                structuredClone(incident),
            ]),

        calculateRoute: vi.fn()
            .mockResolvedValue(route),
    };
}

beforeEach(() => {
    vi.stubEnv(
        'ANTHROPIC_API_KEY',
        'test-no-network',
    );

    messages.mockReset();

    for (
        const name
        of [
            'consultar_incidentes',
            'calcular_desvio',
        ]
    ) {
        messages.mockResolvedValueOnce({
            stop_reason: 'tool_use',

            content: [{
                type: 'tool_use',
                id: name,
                name,
                input: {},
            }],
        });
    }

    messages.mockResolvedValueOnce({
        stop_reason: 'end_turn',

        content: [{
            type: 'text',
            text: 'Alternativa calculada.',
        }],
    });
});

afterEach(() => {
    vi.unstubAllEnvs();
});

it(
    'usa MCP real y solo consulta al inicio y al validar el resultado',
    async () => {
        const api = services();

        const result =
            await replanRoute(context, api);

        expect(result.status)
            .toBe('alternative_ready');

        expect(api.listActiveIncidents)
            .toHaveBeenCalledTimes(2);

        // Reducir lo que recibe Claude no elimina las
        // restricciones necesarias para calcular la ruta.
        expect(api.calculateRoute)
            .toHaveBeenCalledWith(
                expect.objectContaining({
                    blockedAreas: [
                        incident.blockedArea,
                    ],
                }),
            );
    },
);

it(
    'MCP comparte la consulta y entrega únicamente los seis campos permitidos',
    async () => {
        const api = services();

        const session =
            await createRoutingMcpSession(
                context,
                api,
            );

        try {
            const result =
                await session.client.callTool({
                    name: 'consultar_incidentes',
                    arguments: {},
                });

            const expected = {
                status: 'ok',
                scenarioTime: context.scenarioTime,

                incidents: [{
                    id: incident.id,
                    type: incident.type,
                    effect: incident.effect,
                    description: incident.description,

                    startsAt:
                        incident.startsAt.toISOString(),

                    expiresAt:
                        incident.expiresAt.toISOString(),
                }],
            };

            // Verificamos ambas representaciones MCP:
            // contenido estructurado y contenido de texto.
            expect(result.structuredContent)
                .toEqual(expected);

            expect(result.content).toEqual([{
                type: 'text',
                text: JSON.stringify(expected),
            }]);

            await session.client.callTool({
                name: 'calcular_desvio',
                arguments: {},
            });

            expect(api.listActiveIncidents)
                .toHaveBeenCalledTimes(1);

            expect(api.calculateRoute)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        blockedAreas: [
                            incident.blockedArea,
                        ],
                    }),
                );
        } finally {
            await session.close();
        }
    },
);

it.each([
    'geometria',
    'vigencia',
    'alta',
])(
    'rechaza cambios de %s durante la evaluación',
    async (change) => {
        const modified =
            structuredClone(incident);

        if (change === 'geometria') {
            modified.blockedArea.east += 0.00001;
        }

        if (change === 'vigencia') {
            modified.expiresAt =
                new Date('2026-10-17T12:16:00Z');
        }

        if (change === 'alta') {
            modified.id = 'another-id';
        }

        const api = services();

        api.listActiveIncidents
            .mockReset()
            .mockResolvedValueOnce([incident])
            .mockResolvedValueOnce([modified]);

        await expect(
            replanRoute(context, api),
        ).rejects.toMatchObject({
            statusCode: 409,
        });
    },
);

it(
    'la comprobación final usa la lectura fresca si existe',
    async () => {
        const api = {
            ...services(),

            refreshActiveIncidents: vi.fn()
                .mockResolvedValue([]),
        };

        await expect(
            replanRoute(context, api),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(api.listActiveIncidents)
            .toHaveBeenCalledTimes(1);

        expect(api.refreshActiveIncidents)
            .toHaveBeenCalledExactlyOnceWith(
                context.simulationId,
                context.scenarioTime,
            );
    },
);

it(
    'no acepta la ruta si falla la comprobación final',
    async () => {
        const api = {
            ...services(),

            refreshActiveIncidents: vi.fn()
                .mockRejectedValue(
                    new Error('Base no disponible'),
                ),
        };

        await expect(
            replanRoute(context, api),
        ).rejects.toThrow('Base no disponible');
    },
);

it(
    'la huella no depende del orden de propiedades o de registros',
    () => {
        const other = {
            ...incident,
            id: 'other',
        };

        const reordered = Object.fromEntries(
            Object.entries(incident).reverse(),
        ) as Incident;

        expect(
            incidentFingerprint([
                incident,
                other,
            ]),
        ).toBe(
            incidentFingerprint([
                other,
                reordered,
            ]),
        );
    },
);

it(
    'no envía coordenadas ni IDs de tramos aunque el incidente sea grande',
    async () => {
        const api = services();

        const record = {
            ...incident,

            pedestrianImpact: {
                networkVersion: 'v1',
                scope: 'segment' as const,

                segmentIds: Array.from(
                    { length: 300 },
                    (_, index) => `segment-${index}`,
                ),

                segments: [],
            },
        };

        api.listActiveIncidents
            .mockResolvedValue([record]);

        const session =
            await createRoutingMcpSession(
                {
                    ...context,
                    networkVersion: 'v1',
                },
                api,
            );

        try {
            const result =
                await session.client.callTool({
                    name: 'consultar_incidentes',
                    arguments: {},
                });

            const data = result.structuredContent as {
                incidents: Record<string, unknown>[];
            };

            expect(
                Object.keys(
                    data.incidents[0]!,
                ).sort(),
            ).toEqual([
                'description',
                'effect',
                'expiresAt',
                'id',
                'startsAt',
                'type',
            ]);

            expect(JSON.stringify(result))
                .not.toContain('segment-');

            expect(JSON.stringify(result))
                .not.toContain('blockedArea');
        } finally {
            await session.close();
        }
    },
);