import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    createRoutingMcpSession,
} from './routing-session';
import { pedestrianNetwork, resolvePedestrianSelection } from '../services/pedestrian-network';
import type {
    RoutingServices,
} from './routing-session';
import type {
    CalculatedRoute,
} from '../services/routing';
import type {
    Incident,
} from '../services/incidents';

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
    description: 'Bloqueo de prueba.',
    effect: 'blockage',
    reporterName: 'RR-TEST',
    startsAt: new Date('2026-10-17T12:00:00.000Z'),
    type: 'blockage',
    source: 'simulation',
    blockedArea: {
        south: 38.908,
        west: -77.035,
        north: 38.909,
        east: -77.034,
    },
    createdAt: new Date('2026-10-16T08:00:00Z'),
    expiresAt: new Date('2026-10-16T08:15:00Z'),
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

describe('Herramientas MCP de RouteRobots', () => {
    it('publica las dos herramientas esperadas', async () => {
        const services = createServices();
        const session = await createRoutingMcpSession(
            context,
            services,
        );

        try {
            const result = await session.client.listTools();

            expect(
                result.tools.map((tool) => tool.name).sort(),
            ).toEqual([
                'calcular_desvio',
                'consultar_incidentes',
            ]);
        } finally {
            await session.close();
        }
    });

    it('consulta incidentes de la simulación fijada por el backend', async () => {
        const services = createServices();
        const session = await createRoutingMcpSession(
            context,
            services,
        );

        try {
            const result = await session.client.callTool({
                name: 'consultar_incidentes',
                arguments: {},
            });

            expect(result.isError).not.toBe(true);

            expect(
                services.listActiveIncidents,
            ).toHaveBeenCalledWith(
                context.simulationId,
                expect.any(String),
            );
        } finally {
            await session.close();
        }
    });

    it('calcula el desvío usando todos los bloqueos y conserva la geometría', async () => {
        const services = createServices();
        const session = await createRoutingMcpSession(
            context,
            services,
        );

        try {
            const result = await session.client.callTool({
                name: 'calcular_desvio',
                arguments: {},
            });

            expect(result.isError).not.toBe(true);

            expect(services.calculateRoute).toHaveBeenCalledWith({
                origin: context.origin,
                destination: context.destination,
                blockedAreas: [incident.blockedArea],
            });

            expect(session.getCandidate()).toEqual({
                route: alternative,
                incidentIds: [incident.id],
            });

            expect(result.structuredContent).toMatchObject({
                status: 'alternative_calculated',
                distanceMeters: 1100,
                durationSeconds: 800,
            });

            expect(
                result.structuredContent,
            ).not.toHaveProperty('geometry');
        } finally {
            await session.close();
        }
    });

    it('no calcula una alternativa cuando no hay bloqueos activos', async () => {
        const services = createServices();

        services.listActiveIncidents.mockResolvedValue([]);

        const session = await createRoutingMcpSession(
            context,
            services,
        );

        try {
            const result = await session.client.callTool({
                name: 'calcular_desvio',
                arguments: {},
            });

            expect(result.isError).toBe(true);
            expect(services.calculateRoute).not.toHaveBeenCalled();
            expect(session.getCandidate()).toBeNull();
        } finally {
            await session.close();
        }
    });

    it('controla los fallos y no expone detalles internos', async () => {
        const services = createServices();

        services.calculateRoute.mockRejectedValue(
            new Error('Detalle interno privado'),
        );

        const session = await createRoutingMcpSession(
            context,
            services,
        );

        try {
            const result = await session.client.callTool({
                name: 'calcular_desvio',
                arguments: {},
            });

            expect(result.isError).toBe(true);
            expect(session.getCandidate()).toBeNull();

            expect(result.structuredContent).toMatchObject({
                message: 'No se pudo calcular la alternativa.',
            });

            expect(JSON.stringify(result)).not.toContain(
                'Detalle interno privado',
            );
        } finally {
            await session.close();
        }
    });
});

describe('MCP con bloqueos de tramos', () => {
    it('envía IDs al grafo y no convierte la vereda en un rectángulo bloqueado', async () => {
        const services = createServices();
        const impact = resolvePedestrianSelection({ networkVersion: pedestrianNetwork.version,
            scope: 'segment', segmentIds: [pedestrianNetwork.segments[0]!.id] });
        services.listActiveIncidents.mockResolvedValue([{ ...incident, pedestrianImpact: impact }]);
        const session = await createRoutingMcpSession({ ...context, networkVersion: pedestrianNetwork.version }, services);
        try {
            const result = await session.client.callTool({ name: 'calcular_desvio', arguments: {} });
            expect(result.isError).not.toBe(true);
            expect(services.calculateRoute).toHaveBeenCalledWith({
                origin: context.origin, destination: context.destination,
                blockedAreas: [], blockedSegmentIds: impact.segmentIds,
                networkVersion: pedestrianNetwork.version, strictOrigin: true,
            });
        } finally { await session.close(); }
    });
    it('no omite un cierre de vereda si el encargo usa el proveedor general', async () => {
        const services = createServices();
        const impact = resolvePedestrianSelection({ networkVersion: pedestrianNetwork.version,
            scope: 'segment', segmentIds: [pedestrianNetwork.segments[0]!.id] });
        services.listActiveIncidents.mockResolvedValue([{ ...incident, pedestrianImpact: impact }]);
        const session = await createRoutingMcpSession(context, services);
        try {
            const result = await session.client.callTool({ name: 'calcular_desvio', arguments: {} });
            expect(result.isError).toBe(true);
            expect(services.calculateRoute).not.toHaveBeenCalled();
        } finally { await session.close(); }
    });
});
