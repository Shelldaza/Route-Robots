import type {
    RoutingServices,
} from '../mcp/routing-session';

import {
    contains,
} from '../../../shared/surfaces';

import type {
    Point,
    WalkSurface,
} from '../../../shared/surfaces';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import {
    surfaceHistory,
} from './surface-incidents';

import {
    calculateSurfaceRoute,
} from './surface-routing';

import {
    RoutingError,
} from './routing-error';

// Se crea una instancia por evaluación HTTP.
//
// Sus datos no se comparten entre simulaciones ni se conservan
// después de terminar el pedido.
export function createSurfaceEvaluation(
    context: SurfaceContext,
    at: string,
    origin: {
        lng: number;
        lat: number;
    },
    preferredCoordinates?: Point[],
): RoutingServices & {
    getFailure(): RoutingError | null;
} {
    let activePromise:
        Promise<SurfaceIncident[]> | undefined;

    let historyPromise:
        Promise<SurfaceIncident[]> | undefined;

    let failure: RoutingError | null = null;

    const instant = new Date(at).getTime();

    function assertContext(
        simulationId: string,
        time?: string,
    ) {
        if (
            simulationId !== context.simulationId
            || time !== at
        ) {
            throw new RoutingError(
                400,
                'El contexto de la evaluación cambió.',
            );
        }
    }

    async function readActive() {
        const records = await surfaceHistory(
            context.simulationId,
            at,
            false,
        );

        // Mantenemos explícita la regla de vigencia:
        // empieza inclusive y vence de forma exclusiva.
        return records.filter((incident) =>
            incident.effect === 'blockage'
            && incident.startsAt.getTime() <= instant
            && incident.expiresAt.getTime() > instant
        );
    }

    function active() {
        // Guardar la promesa también evita duplicar consultas
        // si dos consumidores piden los datos simultáneamente.
        return activePromise ??= readActive();
    }

    function surfacesAtOrigin(
        records: SurfaceIncident[],
    ): WalkSurface[] {
        return records
            .flatMap((incident) =>
                incident.surfaceImpact?.contextSurfaces
                ?? incident.surfaceImpact?.surfaces
                ?? []
            )
            .filter((surface) =>
                contains(
                    surface.geometry,
                    [origin.lng, origin.lat],
                )
            );
    }

    return {
        async listActiveIncidents(
            simulationId,
            time,
        ) {
            assertContext(simulationId, time);

            return active();
        },

        async refreshActiveIncidents(
            simulationId,
            time,
        ) {
            assertContext(simulationId, time);

            // La validación final SIEMPRE vuelve a consultar
            // la base. No utiliza activePromise.
            return readActive();
        },

        async calculateRoute(value) {
            failure = null;

            try {
                const incidents = await active();

                const known =
                    surfacesAtOrigin(incidents);

                try {
                    return await calculateSurfaceRoute(
                        value,
                        context,
                        incidents,
                        known,
                        preferredCoordinates,
                    );
                } catch (error) {
                    if (
                        !(error instanceof RoutingError)
                        || error.statusCode !== 422
                    ) {
                        throw error;
                    }

                    // Un reporte vencido puede aportar cartografía
                    // necesaria para reconectar al robot.
                    //
                    // Solo buscamos el historial cuando el cálculo
                    // con el contexto activo no alcanza.
                    historyPromise ??= surfaceHistory(
                        context.simulationId,
                        at,
                        true,
                    );

                    const historical = surfacesAtOrigin(
                        await historyPromise,
                    );

                    const signatures = new Set(
                        known.map((surface) =>
                            JSON.stringify([
                                surface.id,
                                surface.geometry,
                            ])
                        ),
                    );

                    const additions = historical.filter(
                        (surface) => {
                            const signature =
                                JSON.stringify([
                                    surface.id,
                                    surface.geometry,
                                ]);

                            if (
                                signatures.has(signature)
                            ) {
                                return false;
                            }

                            signatures.add(signature);

                            return true;
                        },
                    );

                    // Sin cartografía adicional, repetir el mismo
                    // cálculo no aportaría una alternativa nueva.
                    if (!additions.length) {
                        throw error;
                    }

                    // Conservamos geometrías distintas con el mismo
                    // ID para que el motor detecte el conflicto.
                    // No elegimos silenciosamente una de ellas.
                    //
                    // Solo agregamos superficies: los incidentes
                    // vencidos NO vuelven a ser bloqueos activos.
                    return await calculateSurfaceRoute(
                        value,
                        context,
                        incidents,
                        [...known, ...additions],
                        preferredCoordinates,
                    );
                }
            } catch (error) {
                if (error instanceof RoutingError) {
                    failure = error;
                }

                throw error;
            }
        },

        getFailure() {
            return failure;
        },
    };
}