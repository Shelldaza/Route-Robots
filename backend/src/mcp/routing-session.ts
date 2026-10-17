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
    pointSchema,
    RoutingError,
} from '../services/routing';
import type {
    CalculatedRoute,
} from '../services/routing';
import type {
    Incident,
} from '../services/incidents';

const contextSchema = z.object({
    simulationId: z.string().uuid(),
    origin: pointSchema,
    destination: pointSchema,
});

export type RoutingContext = z.infer<typeof contextSchema>;

export type RoutingServices = {
    listActiveIncidents: (
        simulationId: string,
    ) => Promise<Incident[]>;

    calculateRoute: (
        input: unknown,
    ) => Promise<CalculatedRoute>;
};

function toolResult(
    data: Record<string, unknown>,
    isError = false,
) {
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(data),
            },
        ],
        structuredContent: data,
        isError,
    };
}

export async function createRoutingMcpSession(
    value: RoutingContext,
    services: RoutingServices,
) {
    const context = contextSchema.parse(value);

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
                    'Consulta los incidentes activos de la simulación actual. No consulta otras simulaciones.',
                inputSchema: z.object({}).strict(),
            },
            async () => {
                try {
                    const incidents =
                        await services.listActiveIncidents(
                            context.simulationId,
                        );

                    return toolResult({
                        status: 'ok',
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
                    'Calcula una alternativa entre los puntos actuales evitando todos los incidentes activos de la simulación. El servicio valida que no atraviese los bloqueos. No aplica la ruta ni mueve al robot.',
                inputSchema: z.object({}).strict(),
            },
            async () => {
                candidate = null;

                try {
                    const incidents =
                        await services.listActiveIncidents(
                            context.simulationId,
                        );

                    if (incidents.length === 0) {
                        return toolResult(
                            {
                                status: 'no_active_incidents',
                                message:
                                    'No hay bloqueos activos para calcular un desvío.',
                            },
                            true,
                        );
                    }

                    const route = await services.calculateRoute({
                        origin: context.origin,
                        destination: context.destination,
                        blockedAreas: incidents.map(
                            (incident) => incident.blockedArea,
                        ),
                    });

                    const incidentIds = incidents.map(
                        (incident) => incident.id,
                    );

                    candidate = {
                        route,
                        incidentIds,
                    };

                    // La geometría queda en el backend.
                    // El modelo recibe el resumen de la operación.
                    return toolResult({
                        status: 'alternative_calculated',
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

    const transport = new StreamableHTTPClientTransport(
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