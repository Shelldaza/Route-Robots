import { z } from 'zod';
import { pool } from '../db';

import {
    listIncidents,
} from './incidents';

import {
    RoutingError,
} from './routing';

import {
    pedestrianNetwork,
    resolvePedestrianSelection,
} from './pedestrian-network';

import {
    queryPedestrianSegments,
} from './pedestrian-spatial';

import {
    isIncidentType,
} from '../config/incident-catalog';

import type {
    IncidentType,
} from '../config/incident-catalog';

import {
    queryWalkSurfaces,
    SURFACE_SOURCE,
} from './walk-surfaces';

import {
    booleanArea,
    offsetArea,
    squareMeters,
    unionAreas,
} from './surface-geometry';

import {
    areaBounds,
    boxArea,
    isArea,
    lineHits,
} from '../../../shared/surfaces';

import type {
    SurfaceImpact,
} from '../../../shared/surfaces';

import {
    getSurfaceContext,
    robotRadius,
} from './surface-context';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

// Los consumidores actuales conservan los mismos imports.
// El contexto y sus reglas se implementan ahora en un módulo propio.
export {
    contextSchema,
    getSurfaceContext,
    registerSurfaceContext,
    robotRadius,
} from './surface-context';

export type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

const pointSchema = z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
]);

export const previewSchema = z.strictObject({
    simulationId: z.uuid(),
    networkVersion: z.string().min(1),
    scenarioTime: z.string().datetime({ offset: true }),

    box: z.strictObject({
        center: pointSchema,
        halfWidth: z.number().finite().min(0.1).max(20),
        halfLength: z.number().finite().min(0.1).max(20),
        angle: z.number().finite()
            .min(-Math.PI * 2)
            .max(Math.PI * 2),
    }),

    coordinates: z.array(pointSchema).max(20000),

    effect: z.enum([
        'informational',
        'caution',
        'blockage',
    ]).optional(),
});

export const surfaceReportSchema = previewSchema.extend({
    id: z.uuid(),
    type: z.custom<IncidentType>(isIncidentType),
    description: z.string().trim().min(1).max(500),
    startsAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int().min(1).max(43200),
    multipleSurfaces: z.boolean(),
});

export type SurfaceReport =
    z.infer<typeof surfaceReportSchema>;

export async function existingSurfaceReport(
    input: SurfaceReport,
): Promise<boolean> {
    const result = await pool.query<{
        simulationId: string;
        type: string;
        description: string;
        effect: string;
        startsAt: Date;
        expiresAt: Date;
        box: unknown;
    }>(`
        SELECT
            i.simulation_id AS "simulationId",
            i.type,
            i.description,
            i.effect,
            i.starts_at AS "startsAt",
            i.expires_at AS "expiresAt",
            s.impact->'box' AS box
        FROM incidents i
        LEFT JOIN incident_surfaces s ON s.incident_id = i.id
        WHERE i.id = $1
    `, [input.id]);

    const row = result.rows[0];

    if (!row) return false;

    const keys = [
        'center',
        'halfWidth',
        'halfLength',
        'angle',
    ] as const;

    const box = row.box as typeof input.box | null;

    if (
        row.simulationId !== input.simulationId
        || row.type !== input.type
        || row.description !== input.description
        || row.effect !== (input.effect ?? 'blockage')
        || new Date(row.startsAt).getTime()
            !== Date.parse(input.startsAt)
        || new Date(row.expiresAt).getTime()
            !== Date.parse(input.startsAt)
                + input.durationMinutes * 60000
        || !box
        || keys.some((key) =>
            JSON.stringify(box[key])
            !== JSON.stringify(input.box[key])
        )
    ) {
        throw new RoutingError(
            409,
            'Ese identificador ya pertenece a otro reporte.',
        );
    }

    return true;
}

export async function surfaceHistory(
    simulationId: string,
    scenarioTime: string,
    includeHistory = true,
): Promise<SurfaceIncident[]> {
    const incidents = await listIncidents(simulationId, {
        scenarioTime,
        includeHistory,
    });

    const result = await pool.query<{
        id: string;
        impact: SurfaceImpact;
    }>(`
        SELECT
            s.incident_id AS id,
            s.impact
        FROM incident_surfaces s
        JOIN incidents i ON i.id = s.incident_id
        WHERE i.simulation_id = $1
          AND (
              $3::boolean
              OR (
                  i.starts_at <= $2::timestamptz
                  AND i.expires_at > $2::timestamptz
              )
          )
    `, [simulationId, scenarioTime, includeHistory]);

    const byId = new Map<string, SurfaceImpact>();

    for (const row of result.rows) {
        if (
            !row.impact
            || !isArea(row.impact.geometry)
            || !isArea(row.impact.collisionGeometry)
            || !Array.isArray(row.impact.surfaces)
        ) {
            throw new RoutingError(
                500,
                'Hay un reporte de superficie inválido.',
            );
        }

        byId.set(row.id, row.impact);
    }

    return incidents.map((incident) => ({
        ...incident,
        surfaceImpact: byId.get(incident.id) ?? null,
    }));
}

export async function prepareSurfaceImpact(
    input: z.infer<typeof previewSchema>,
): Promise<{
    context: SurfaceContext;
    impact: SurfaceImpact;
}> {
    const context = await getSurfaceContext(
        input.simulationId,
    );

    if (
        !context
        || context.networkVersion !== input.networkVersion
        || input.networkVersion !== pedestrianNetwork.version
    ) {
        throw new RoutingError(
            409,
            'La entrega y la red del escenario no coinciden.',
        );
    }

    const radius = robotRadius(context);
    const rectangle = boxArea(input.box);

    const candidates = await queryWalkSurfaces(
        areaBounds(rectangle, 35),
    );

    const walkable = candidates.filter((surface) =>
        [1480, 1483].includes(surface.code)
    );

    // Este límite protege la memoria del servidor al procesar
    // la cartografía utilizada para verificar el paso local.
    const contextVertices = walkable.reduce(
        (sum, surface) =>
            sum + surface.geometry.coordinates.flat(2).length,
        0,
    );

    if (
        walkable.length > 80
        || contextVertices > 15000
    ) {
        throw new RoutingError(
            413,
            'La cartografía cercana supera el límite de procesamiento del servidor. No se pudo verificar esta selección.',
        );
    }

    // Recortamos cada superficie antes de medir la complejidad
    // del incidente. Un polígono grande puede producir un
    // incidente pequeño y sencillo.
    const intersections = walkable
        .map((surface) => ({
            surface,
            geometry: booleanArea(
                surface.geometry,
                rectangle,
                'intersection',
            ),
        }))
        .filter((part) =>
            squareMeters(part.geometry) >= 0.01
        );

    if (!intersections.length) {
        throw new RoutingError(
            400,
            'El rectángulo no ocupa una vereda o cruce de la cartografía disponible.',
        );
    }

    // Conservamos las superficies originales para que el
    // cálculo posterior pueda buscar espacio alrededor.
    const surfaces = intersections.map(
        (part) => part.surface,
    );

    // La geometría del incidente contiene solamente
    // lo que quedó dentro del rectángulo.
    const geometry = unionAreas(
        intersections.map((part) => part.geometry),
    );

    const affectedVertices =
        geometry.coordinates.flat(2).length;

    if (affectedVertices > 5000) {
        throw new RoutingError(
            413,
            'El área recortada del incidente tiene demasiados detalles para procesarla. Ajustá la selección.',
        );
    }

    const near = offsetArea(geometry, 2);

    const segments = queryPedestrianSegments(
        areaBounds(near),
        1001,
    ).filter((segment) =>
        lineHits(segment.coordinates, near)
    );

    if (segments.length > 1000) {
        throw new RoutingError(
            413,
            'Reducí el área del incidente.',
        );
    }

    return {
        context,
        impact: {
            geometry,
            collisionGeometry: offsetArea(
                geometry,
                radius + 0.01,
            ),
            surfaces,
            contextSurfaces: walkable,
            segmentIds: segments.map(
                (segment) => segment.id,
            ),
            source: SURFACE_SOURCE,
            retrievedAt: new Date().toISOString(),
            box: input.box,
            unknown: false,
        },
    };
}

export async function saveSurfaceReport(
    input: SurfaceReport,
    impact: SurfaceImpact,
) {
    if (
        impact.surfaces.length > 1
        && !input.multipleSurfaces
    ) {
        throw new RoutingError(
            400,
            'Confirmá que el incidente afecta varias superficies.',
        );
    }

    const ids = impact.segmentIds.slice(0, 30);

    const pedestrianImpact = ids.length
        ? resolvePedestrianSelection({
            networkVersion: input.networkVersion,
            scope: ids.length === 1
                ? 'segment'
                : 'street_section',
            segmentIds: ids,
        })
        : null;

    const bounds = areaBounds(impact.geometry, 0.01);
    const starts = new Date(input.startsAt);

    const expires = new Date(
        starts.getTime() + input.durationMinutes * 60000,
    );

    if (!Number.isFinite(expires.getTime())) {
        throw new RoutingError(
            400,
            'La fecha de fin es inválida.',
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const inserted = await client.query(`
            INSERT INTO incidents (
                id,
                simulation_id,
                type,
                source,
                description,
                effect,
                reporter_name,
                south,
                west,
                north,
                east,
                starts_at,
                expires_at,
                pedestrian_impact
            )
            VALUES (
                $1, $2, $3, 'manual', $4, $5, 'Usuario',
                $6, $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `, [
            input.id,
            input.simulationId,
            input.type,
            input.description,
            input.effect ?? 'blockage',
            bounds.south,
            bounds.west,
            bounds.north,
            bounds.east,
            starts,
            expires,
            pedestrianImpact
                ? JSON.stringify(pedestrianImpact)
                : null,
        ]);

        if (inserted.rows.length) {
            await client.query(`
                INSERT INTO incident_surfaces (incident_id, impact)
                VALUES ($1, $2)
            `, [input.id, JSON.stringify(impact)]);
        } else {
            const previous = await client.query(`
                SELECT i.id
                FROM incidents i
                JOIN incident_surfaces s ON s.incident_id = i.id
                WHERE i.id = $1
                  AND i.simulation_id = $2
                  AND i.type = $3
                  AND i.description = $4
                  AND i.starts_at = $5
                  AND i.expires_at = $6
                  AND s.impact->'box' = $7::jsonb
                  AND i.effect = $8
            `, [
                input.id,
                input.simulationId,
                input.type,
                input.description,
                starts,
                expires,
                JSON.stringify(input.box),
                input.effect ?? 'blockage',
            ]);

            if (!previous.rows.length) {
                throw new RoutingError(
                    409,
                    'Ese identificador ya pertenece a otro reporte.',
                );
            }
        }

        await client.query('COMMIT');

        return {
            id: input.id,
            simulationId: input.simulationId,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}