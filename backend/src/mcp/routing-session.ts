import {
    Client,
    StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

import {
    createMcpHandler,
    McpServer,
} from '@modelcontextprotocol/server';

import { z } from 'zod';

import {
    RoutingError,
} from '../services/routing';

import {
    toRoutingIncidents,
    buildRestrictedRouteRequest,
} from '../services/routing-restrictions';

import {
    routingContextSchema,
} from '../schemas/routing-context';

import type {
    CalculatedRoute,
} from '../services/routing';

import type {
    RoutingIncidentInput,
} from '../types/routing-restrictions';

import type {
    RoutingContext,
} from '../schemas/routing-context';

export type {
    RoutingContext,
} from '../schemas/routing-context';

export type RoutingServices = {
    listActiveIncidents: (
        simulationId: string,
        scenarioTime?: string,
    ) => Promise<RoutingIncidentInput[]>;

    calculateRoute: (
        input: unknown,
    ) => Promise<CalculatedRoute>;
};

function toolResult(
    data: Record<string, unknown>,
    isError = false,
) {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(data),
        }],
        structuredContent: data,
        isError,
    };
}

/**
 * Crea una sesión MCP con contexto fijado por el backend.
 *
 * El modelo puede solicitar herramientas, pero no cambiar
 * la simulación, los extremos ni la fecha.
 */
export async function createRoutingMcpSession(
    value: RoutingContext,
    services: RoutingServices,
) {
    const parsed = routingContextSchema.parse(value);

    const context = {
        ...parsed,
        scenarioTime:
            parsed.scenarioTime ?? new Date().toISOString(),
    };

    let candidate: {
        route: CalculatedRoute;
        incidentIds: string[];
    } | null = null;

    const handler = createMcpHandler(() => {
        const server = new McpServer({
            name: 'routerobots-routing',
            version: '1.0.0',
        });

        server.registerTool(
            'consultar_incidentes',
            {
                description:
                    'Consulta los bloqueos activos de la simulación en la fecha fijada por el backend. No consulta otras simulaciones ni modifica la fecha.',
                inputSchema: z.object({}).strict(),
            },
            async () => {
                try {
                    const incidents = toRoutingIncidents(
                        await services.listActiveIncidents(
                            context.simulationId,
                            context.scenarioTime,
                        ),
                        context.networkVersion,
                    );

                    return toolResult({
                        status: 'ok',
                        scenarioTime: context.scenarioTime,
                        incidents,
                    });
                } catch {
                    return toolResult(
                        {
                            status: 'error',
                            message:
                                'No se pudieron consultar los incidentes.',
                        },
                        true,
                    );
                }
            },
        );

        server.registerTool(
            'calcular_desvio',
            {
                description:
                    'Calcula una alternativa entre los puntos fijados por el backend evitando todos los bloqueos activos en la fecha del escenario. El servicio valida que no atraviese los bloqueos. No aplica la ruta ni mueve al robot.',
                inputSchema: z.object({}).strict(),
            },
            async () => {
                candidate = null;

                try {
                    const incidents = toRoutingIncidents(
                        await services.listActiveIncidents(
                            context.simulationId,
                            context.scenarioTime,
                        ),
                        context.networkVersion,
                    );

                    if (incidents.length === 0) {
                        return toolResult(
                            {
                                status: 'no_active_incidents',
                                message:
                                    'No hay bloqueos activos para calcular un desvío en ese momento del escenario.',
                            },
                            true,
                        );
                    }

                    // La traducción del alcance queda centralizada.
                    // MCP no necesita interpretar geometrías ni
                    // reconocer impactos peatonales ficticios.
                    const route = await services.calculateRoute(
                        buildRestrictedRouteRequest(
                            context,
                            incidents,
                        ),
                    );

                    const incidentIds = incidents.map(
                        (incident) => incident.id,
                    );

                    candidate = {
                        route,
                        incidentIds,
                    };

                    // La ruta completa permanece en el backend.
                    return toolResult({
                        status: 'alternative_calculated',
                        scenarioTime: context.scenarioTime,
                        distanceMeters: route.distanceMeters,
                        durationSeconds: route.durationSeconds,
                        profile: route.profile,
                        incidentIds,
                    });
                } catch (error) {
                    return toolResult(
                        {
                            status: 'error',
                            message:
                                error instanceof RoutingError
                                    ? error.message
                                    : 'No se pudo calcular la alternativa.',
                        },
                        true,
                    );
                }
            },
        );

        return server;
    });

    const client = new Client(
        {
            name: 'routerobots-agent',
            version: '1.0.0',
        },
        {
            versionNegotiation: {
                mode: 'auto',
            },
        },
    );

    const transport =
        new StreamableHTTPClientTransport(
            new URL('http://routerobots.internal/mcp'),
            {
                fetch: (url, init) =>
                    handler.fetch(new Request(url, init)),
            },
        );

    try {
        await client.connect(transport);
    } catch (error) {
        await client.close();
        throw error;
    }

    return {
        client,

        getCandidate() {
            return candidate;
        },

        async close() {
            await client.close();
        },
    };
}