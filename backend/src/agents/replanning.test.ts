import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import type {
    RoutingServices,
} from '../mcp/routing-session';
import type {
    CalculatedRoute,
} from '../services/routing';
import type {
    Incident,
} from '../services/incidents';

const {
    messagesMock,
    createSessionMock,
    listToolsMock,
    callToolMock,
    candidateMock,
    closeMock,
} = vi.hoisted(() => ({
    messagesMock: vi.fn(),
    createSessionMock: vi.fn(),
    listToolsMock: vi.fn(),
    callToolMock: vi.fn(),
    candidateMock: vi.fn(),
    closeMock: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = {
            create: messagesMock,
        };
    },
}));

vi.mock('../mcp/routing-session', () => ({
    createRoutingMcpSession: createSessionMock,
}));

import {
    replanRoute,
} from './replanning';

const context = {
    simulationId: '21bd592c-0da1-43d4-9307-8494429bd15b',
    origin: {
        lat: 38.9072,
        lng: -77.0369,
    },
    destination: {
        lat: 38.91,
        lng: -77.03,
    },
    scenarioTime: '2026-10-17T12:05:00.000Z',
};

const incident: Incident = {
    id: 'f88bbd1b-dc80-4339-b734-a82b717d51db',
    simulationId: context.simulationId,
    type: 'blockage',
    description: 'Bloqueo de prueba.',
    effect: 'blockage',
    reporterName: 'RR-TEST',
    startsAt: new Date('2026-10-17T12:00:00.000Z'),
    source: 'simulation',
    blockedArea: {
        south: 38.908,
        west: -77.035,
        north: 38.909,
        east: -77.034,
    },
    createdAt: new Date('2026-10-17T12:00:00.000Z'),
    expiresAt: new Date('2026-10-17T12:15:00.000Z'),
};

const alternative: CalculatedRoute = {
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

function createServices() {
    return {
        listActiveIncidents: vi.fn<
            RoutingServices['listActiveIncidents']
        >().mockResolvedValue([incident]),

        calculateRoute: vi.fn<
            RoutingServices['calculateRoute']
        >().mockResolvedValue(alternative),
    };
}

function toolResponse(
    name: string,
    callId: string,
    input: unknown = {},
) {
    return {
        stop_reason: 'tool_use',
        content: [
            {
                type: 'tool_use',
                id: callId,
                name,
                input,
            },
        ],
    };
}

function finalResponse(
    text = 'Se obtuvo una alternativa de 1100 metros evitando el bloqueo.',
) {
    return {
        stop_reason: 'end_turn',
        content: [
            {
                type: 'text',
                text,
            },
        ],
    };
}

function queueSuccessfulEvaluation() {
    messagesMock
        .mockResolvedValueOnce(
            toolResponse('consultar_incidentes', 'call_1'),
        )
        .mockResolvedValueOnce(
            toolResponse('calcular_desvio', 'call_2'),
        )
        .mockResolvedValueOnce(finalResponse());
}

describe('Agente de replanificación con Claude', () => {
    beforeEach(() => {
        messagesMock.mockReset();
        createSessionMock.mockReset();
        listToolsMock.mockReset();
        callToolMock.mockReset();
        candidateMock.mockReset();
        closeMock.mockReset();

        vi.stubEnv(
            'ANTHROPIC_API_KEY',
            'clave-falsa-de-prueba',
        );
        vi.stubEnv(
            'ANTHROPIC_MODEL',
            'modelo-de-prueba',
        );

        listToolsMock.mockResolvedValue({
            tools: [
                {
                    name: 'consultar_incidentes',
                    description: 'Consultar incidentes.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                    },
                },
                {
                    name: 'calcular_desvio',
                    description: 'Calcular un desvío.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                    },
                },
            ],
        });

        candidateMock.mockReturnValue(null);
        closeMock.mockResolvedValue(undefined);

        callToolMock.mockImplementation(
            async ({ name }: { name: string }) => {
                if (name === 'calcular_desvio') {
                    candidateMock.mockReturnValue({
                        route: alternative,
                        incidentIds: [incident.id],
                    });
                }

                return {
                    isError: false,
                    content: [],
                    structuredContent: {
                        status: 'ok',
                    },
                };
            },
        );

        createSessionMock.mockResolvedValue({
            client: {
                listTools: listToolsMock,
                callTool: callToolMock,
            },
            getCandidate: candidateMock,
            close: closeMock,
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('devuelve la geometría del backend en tres consultas y conserva la fecha', async () => {
        const services = createServices();
        queueSuccessfulEvaluation();

        const result = await replanRoute(context, services);

        expect(result.status).toBe('alternative_ready');
        expect(result.route).toEqual(alternative);
        expect(result.incidentIds).toEqual([incident.id]);
        expect(result.scenarioTime).toBe(context.scenarioTime);

        expect(result.toolCalls).toEqual([
            {
                name: 'consultar_incidentes',
                success: true,
            },
            {
                name: 'calcular_desvio',
                success: true,
            },
        ]);

        expect(messagesMock).toHaveBeenCalledTimes(3);

        expect(messagesMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                model: 'modelo-de-prueba',
                tool_choice: {
                    type: 'tool',
                    name: 'consultar_incidentes',
                    disable_parallel_tool_use: true,
                },
            }),
        );

        expect(messagesMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tool_choice: {
                    type: 'none',
                },
                thinking: {
                    type: 'disabled',
                },
                max_tokens: 400,
                messages: expect.arrayContaining([
                    {
                        role: 'user',
                        content: [
                            expect.objectContaining({
                                type: 'tool_result',
                                tool_use_id: 'call_1',
                                is_error: false,
                            }),
                        ],
                    },
                    {
                        role: 'user',
                        content: [
                            expect.objectContaining({
                                type: 'tool_result',
                                tool_use_id: 'call_2',
                                is_error: false,
                            }),
                        ],
                    },
                ]),
            }),
        );

        expect(services.listActiveIncidents)
            .toHaveBeenNthCalledWith(
                1,
                context.simulationId,
                context.scenarioTime,
            );

        expect(services.listActiveIncidents)
            .toHaveBeenNthCalledWith(
                2,
                context.simulationId,
                context.scenarioTime,
            );

        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('no consume IA cuando no hay bloqueos activos', async () => {
        const services = createServices();
        services.listActiveIncidents.mockResolvedValue([]);

        await expect(
            replanRoute(context, services),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(messagesMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rechaza una herramienta repetida sin volver a ejecutarla', async () => {
        messagesMock
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_1'),
            )
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_2'),
            );

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(messagesMock).toHaveBeenCalledTimes(2);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('rechaza la alternativa si cambiaron los incidentes', async () => {
        const services = createServices();

        services.listActiveIncidents
            .mockResolvedValueOnce([incident])
            .mockResolvedValueOnce([]);

        queueSuccessfulEvaluation();

        await expect(
            replanRoute(context, services),
        ).rejects.toMatchObject({
            statusCode: 409,
            message:
                'Los incidentes cambiaron durante la evaluación. Solicitá nuevamente el desvío.',
        });

        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('no convierte una explicación en una ruta inexistente', async () => {
        messagesMock
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_1'),
            )
            .mockResolvedValueOnce(
                finalResponse(
                    'No se obtuvo una alternativa validada.',
                ),
            );

        const result = await replanRoute(
            context,
            createServices(),
        );

        expect(result.status).toBe('not_replanned');
        expect(result.route).toBeNull();
        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('detiene el flujo si falla la consulta MCP', async () => {
        messagesMock.mockResolvedValueOnce(
            toolResponse('consultar_incidentes', 'call_1'),
        );

        callToolMock.mockResolvedValueOnce({
            isError: true,
            content: [],
            structuredContent: {
                message: 'No se pudieron consultar los incidentes.',
            },
        });

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(messagesMock).toHaveBeenCalledTimes(1);
        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('impide modificar el contexto mediante argumentos', async () => {
        messagesMock.mockResolvedValueOnce(
            toolResponse(
                'consultar_incidentes',
                'call_1',
                { simulationId: 'otra-simulacion' },
            ),
        );

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(callToolMock).not.toHaveBeenCalled();
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('rechaza una respuesta truncada por el límite de tokens', async () => {
        messagesMock.mockResolvedValueOnce({
            stop_reason: 'max_tokens',
            content: [],
        });

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 502,
            message:
                'La IA no completó la evaluación. No se modificó la ruta.',
        });

        expect(callToolMock).not.toHaveBeenCalled();
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('rechaza calcular antes de consultar los incidentes', async () => {
        messagesMock.mockResolvedValueOnce(
            toolResponse('calcular_desvio', 'call_1'),
        );

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(callToolMock).not.toHaveBeenCalled();
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('informa si falta la clave sin llamar a Claude', async () => {
        vi.stubEnv('ANTHROPIC_API_KEY', '');

        await expect(
            replanRoute(context, createServices()),
        ).rejects.toMatchObject({
            statusCode: 503,
        });

        expect(messagesMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('usa Haiku por defecto si no se configuró un modelo', async () => {
        vi.stubEnv('ANTHROPIC_MODEL', '');
        queueSuccessfulEvaluation();

        await replanRoute(context, createServices());

        expect(messagesMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                model: 'claude-haiku-5-5',
            }),
        );
    });
});