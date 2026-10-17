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
    responsesMock,
    createSessionMock,
    listToolsMock,
    callToolMock,
    candidateMock,
    closeMock,
} = vi.hoisted(() => ({
    responsesMock: vi.fn(),
    createSessionMock: vi.fn(),
    listToolsMock: vi.fn(),
    callToolMock: vi.fn(),
    candidateMock: vi.fn(),
    closeMock: vi.fn(),
}));

vi.mock('openai', () => ({
    default: class {
        responses = {
            create: responsesMock,
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
};

const incident: Incident = {
    id: 'f88bbd1b-dc80-4339-b734-a82b717d51db',
    simulationId: context.simulationId,
    type: 'blockage',
    source: 'simulation',
    blockedArea: {
        south: 38.908,
        west: -77.035,
        north: 38.909,
        east: -77.034,
    },
    createdAt: new Date('2026-10-17T04:00:00Z'),
    expiresAt: new Date('2026-10-17T04:15:00Z'),
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
) {
    return {
        status: 'completed',
        output_text: '',
        output: [
            {
                type: 'function_call',
                id: `fc_${callId}`,
                call_id: callId,
                name,
                arguments: '{}',
                status: 'completed',
            },
        ],
    };
}

function finalResponse() {
    return {
        status: 'completed',
        output: [],
        output_text:
            'Se obtuvo una alternativa de 1100 metros evitando el bloqueo.',
    };
}

function queueSuccessfulEvaluation() {
    responsesMock
        .mockResolvedValueOnce(
            toolResponse('consultar_incidentes', 'call_1'),
        )
        .mockResolvedValueOnce(
            toolResponse('calcular_desvio', 'call_2'),
        )
        .mockResolvedValueOnce(finalResponse());
}

describe('Agente de replanificación', () => {
    beforeEach(() => {
        responsesMock.mockReset();
        createSessionMock.mockReset();
        listToolsMock.mockReset();
        callToolMock.mockReset();
        candidateMock.mockReset();
        closeMock.mockReset();

        // Las pruebas nunca utilizan la clave real.
        vi.stubEnv('OPENAI_API_KEY', 'clave-falsa-de-prueba');
        vi.stubEnv('OPENAI_MODEL', 'modelo-de-prueba');

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

    it('devuelve la geometría del backend y completa la evaluación en tres consultas', async () => {
        const services = createServices();
        queueSuccessfulEvaluation();

        const result = await replanRoute(context, services);

        expect(result.status).toBe('alternative_ready');
        expect(result.route).toEqual(alternative);
        expect(result.incidentIds).toEqual([incident.id]);

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

        expect(responsesMock).toHaveBeenCalledTimes(3);

        expect(responsesMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tool_choice: 'none',
                parallel_tool_calls: false,
                max_output_tokens: 400,
            }),
        );

        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('no consume consultas de IA cuando no hay bloqueos activos', async () => {
        const services = createServices();

        services.listActiveIncidents.mockResolvedValue([]);

        await expect(
            replanRoute(context, services),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(responsesMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rechaza una herramienta repetida sin volver a ejecutarla', async () => {
        const services = createServices();

        responsesMock
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_1'),
            )
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_2'),
            );

        await expect(
            replanRoute(context, services),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(responsesMock).toHaveBeenCalledTimes(2);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('rechaza una alternativa si los incidentes cambiaron durante la evaluación', async () => {
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

    it('no convierte una explicación del modelo en una ruta inexistente', async () => {
        const services = createServices();

        responsesMock
            .mockResolvedValueOnce(
                toolResponse('consultar_incidentes', 'call_1'),
            )
            .mockResolvedValueOnce({
                status: 'completed',
                output: [],
                output_text:
                    'No se obtuvo una alternativa validada.',
            });

        const result = await replanRoute(context, services);

        expect(result.status).toBe('not_replanned');
        expect(result.route).toBeNull();
        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('detiene el flujo si falla la consulta MCP de incidentes', async () => {
        const services = createServices();

        responsesMock.mockResolvedValueOnce(
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
            replanRoute(context, services),
        ).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(responsesMock).toHaveBeenCalledTimes(1);
        expect(callToolMock).toHaveBeenCalledTimes(1);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });
});