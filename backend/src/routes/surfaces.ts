import { createSurfaceEvaluation } from '../services/surface-evaluation';
import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

import {
    RoutingError,
} from '../services/routing';

import {
    routingContextSchema,
} from '../schemas/routing-context';

import {
    replanRoute,
    ReplanningError,
} from '../agents/replanning';

import {
    queryWalkSurfaces,
    surfaceBoundsSchema,
    SURFACE_SOURCES,
} from '../services/walk-surfaces';

import {
    contextSchema,
    existingSurfaceReport,
    getSurfaceContext,
    prepareSurfaceImpact,
    previewSchema,
    registerSurfaceContext,
    robotRadius,
    saveSurfaceReport,
    surfaceHistory,
    surfaceReportSchema,
} from '../services/surface-incidents';

import {
    previewSurfacePath,
} from '../services/surface-routing';

import {
    createIncident,
    findIncidentById,
} from '../services/incidents';

import {
    pedestrianSelectionSchema,
    resolvePedestrianSelection,
} from '../services/pedestrian-network';

import {
    placementSchema,
    placeIncident,
} from '../services/incident-placement';


const surfaceReplanningSchema = routingContextSchema.extend({
    preferredCoordinates: z
        .array(
            z.tuple([
                z.number().finite().min(-180).max(180),
                z.number().finite().min(-90).max(90),
            ]),
        )
        .min(2)
        .max(20000)
        .optional(),
});

export const surfacesRouter = Router();
export const surfaceReplanningRouter = Router();

const historySchema = z.object({
    simulationId: z.uuid(),
    scenarioTime: z.string().datetime({ offset: true }),
});

const segmentReportSchema = surfaceReportSchema
    .omit({
        box: true,
        multipleSurfaces: true,
    })
    .extend({
        pedestrianSelection: pedestrianSelectionSchema,

        effect: z.enum([
            'informational',
            'caution',
            'blockage',
        ]).default('blockage'),
    });

function failure(
    error: unknown,
    response: Response,
) {
    if (
        error instanceof RoutingError
        || error instanceof ReplanningError
    ) {
        response.status(error.statusCode).json({
            message: error.message,
        });
    } else if (error instanceof Anthropic.APIError) {
        response.status(502).json({
            message:
                'El servicio de IA no pudo completar la evaluación.',
        });
    } else {
        console.error(
            'Error de superficies:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        response.status(500).json({
            message:
                'No se pudo completar la operación de superficies.',
        });
    }
}

surfacesRouter.get('/', async (request, response) => {
    const input = surfaceBoundsSchema.safeParse(
        request.query,
    );

    const source = z.enum([
        'current',
        'archive',
    ]).safeParse(request.query.source ?? 'current');

    if (!input.success || !source.success) {
        response.status(400).json({
            message:
                'Acercá el mapa dentro de Washington para cargar superficies.',
        });
        return;
    }

    try {
        response.json({
            source: SURFACE_SOURCES[source.data],

            surfaces: await queryWalkSurfaces(
                input.data,
                source.data,
            ),
        });
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.post('/context', async (request, response) => {
    const input = contextSchema.safeParse(request.body);

    if (!input.success) {
        response.status(400).json({
            message: 'El contexto del robot es inválido.',
        });
        return;
    }

    try {
        response.json(
            await registerSurfaceContext(input.data),
        );
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.get('/history', async (request, response) => {
    const input = historySchema.safeParse(request.query);

    if (!input.success) {
        response.status(400).json({
            message: 'La simulación o la fecha es inválida.',
        });
        return;
    }

    try {
        response.json(
            await surfaceHistory(
                input.data.simulationId,
                input.data.scenarioTime,
            ),
        );
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.post('/placement', async (request, response) => {
    const input = placementSchema.safeParse(request.body);

    if (!input.success) {
        response.status(400).json({
            message: 'La ubicación elegida es inválida.',
        });
        return;
    }

    try {
        response.json(
            await placeIncident(input.data),
        );
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.post('/preview', async (request, response) => {
    const input = previewSchema.safeParse(request.body);

    if (!input.success) {
        response.status(400).json({
            message: 'La selección visual es inválida.',
        });
        return;
    }

    try {
        const { context, impact } =
            await prepareSurfaceImpact(input.data);

        const active = (
            await surfaceHistory(
                context.simulationId,
                input.data.scenarioTime,
                false,
            )
        ).filter((incident) =>
            incident.effect === 'blockage'
        );

        const effect = input.data.effect ?? 'blockage';

        const analysis = effect === 'blockage'
            ? previewSurfacePath(
                input.data.coordinates,
                [
                    ...active.flatMap((incident) =>
                        incident.surfaceImpact
                            ? [incident.surfaceImpact]
                            : []
                    ),
                    impact,
                ],
                robotRadius(context),
                active,
            )
            : {
                state: 'notice',

                message: effect === 'caution'
                    ? 'Precaución: el reporte advierte del riesgo y no cierra el paso automáticamente.'
                    : 'Informativo: el reporte se muestra en el mapa sin restringir el paso.',

                coordinates: [],

                free: {
                    type: 'MultiPolygon' as const,
                    coordinates: [],
                },
            };

        response.json({
            impact,
            analysis,
        });
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.post('/incidents', async (request, response) => {
    const input = surfaceReportSchema.safeParse(request.body);

    if (!input.success) {
        response.status(400).json({
            message:
                'Revisá la selección, el efecto, la descripción y la duración.',
        });
        return;
    }

    try {
        if (await existingSurfaceReport(input.data)) {
            response.status(201).json({
                id: input.data.id,
                simulationId: input.data.simulationId,
            });
            return;
        }

        const { impact } =
            await prepareSurfaceImpact(input.data);

        response.status(201).json(
            await saveSurfaceReport(
                input.data,
                impact,
            ),
        );
    } catch (error) {
        failure(error, response);
    }
});

surfacesRouter.post('/segments', async (request, response) => {
    const input = segmentReportSchema.safeParse(
        request.body,
    );

    if (!input.success) {
        response.status(400).json({
            message:
                'Revisá los tramos, el efecto y los datos del incidente.',
        });
        return;
    }

    try {
        const data = input.data;

        const context = await getSurfaceContext(
            data.simulationId,
        );

        if (
            !context
            || context.networkVersion !== data.networkVersion
            || data.pedestrianSelection.networkVersion
                !== data.networkVersion
        ) {
            throw new RoutingError(
                409,
                'La selección no corresponde a la red de esta entrega.',
            );
        }

        try {
            resolvePedestrianSelection(
                data.pedestrianSelection,
            );
        } catch (error) {
            throw new RoutingError(
                400,
                error instanceof Error
                    ? error.message
                    : 'La selección no es válida.',
            );
        }

        const matches = (
            incident: NonNullable<
                Awaited<ReturnType<typeof findIncidentById>>
            >,
        ) =>
            incident.simulationId === data.simulationId
            && incident.type === data.type
            && incident.source === 'manual'
            && incident.effect === data.effect
            && incident.description === data.description

            && new Date(incident.startsAt).getTime()
                === Date.parse(data.startsAt)

            && new Date(incident.expiresAt).getTime()
                === Date.parse(data.startsAt)
                    + data.durationMinutes * 60000

            && incident.pedestrianImpact?.networkVersion
                === data.networkVersion

            && incident.pedestrianImpact.scope
                === data.pedestrianSelection.scope

            && JSON.stringify(
                [...incident.pedestrianImpact.segmentIds].sort(),
            ) === JSON.stringify(
                [...data.pedestrianSelection.segmentIds].sort(),
            );

        const existing = await findIncidentById(data.id);

        if (existing && !matches(existing)) {
            throw new RoutingError(
                409,
                'Ese identificador ya pertenece a otro reporte.',
            );
        }

        const incident = existing ?? await createIncident({
            simulationId: data.simulationId,
            type: data.type,
            source: 'manual',
            effect: data.effect,
            description: data.description,
            durationMinutes: data.durationMinutes,
            startsAt: data.startsAt,
            reporterName: 'Usuario',
            pedestrianSelection: data.pedestrianSelection,
        }, data.id);

        if (!matches(incident)) {
            throw new RoutingError(
                409,
                'Ese identificador ya pertenece a otro reporte.',
            );
        }

        response.status(201).json({
            id: incident.id,
            simulationId: incident.simulationId,
        });
    } catch (error) {
        failure(error, response);
    }
});

surfaceReplanningRouter.post(
    '/',
    async (request, response, next) => {
        const input = surfaceReplanningSchema.safeParse(
            request.body,
        );

        if (!input.success) {
            next();
            return;
        }

        try {
            const context = await getSurfaceContext(
                input.data.simulationId,
            );

            if (!context) {
                next();
                return;
            }

            if (
                context.networkVersion
                !== input.data.networkVersion
            ) {
                throw new RoutingError(
                    409,
                    'La red del escenario cambió.',
                );
            }

            const at =
                input.data.scenarioTime
                ?? new Date().toISOString();

            // El recorrido queda disponible para el cálculo del
            // backend, sin enviarlo al modelo de IA.
            const {
                preferredCoordinates,
                ...routingContext
            } = input.data;

            const evaluation = createSurfaceEvaluation(
                context,
                at,
                input.data.origin,
                preferredCoordinates,
            );

            const result = await replanRoute(
                {
                    ...routingContext,
                    scenarioTime: at,
                },
                evaluation,
            );

            const calculationFailure = evaluation.getFailure();

            response.json(
                result.status === 'not_replanned'
                && calculationFailure
                    ? {
                        ...result,
                        explanation:
                            (calculationFailure as RoutingError)
                                .message,
                    }
                    : result,
            );
        } catch (error) {
            failure(error, response);
        }
    },
);