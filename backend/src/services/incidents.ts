import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db';
import { pedestrianSelectionSchema, resolvePedestrianSelection, impactBounds } from './pedestrian-network';
import type { PedestrianImpact } from './pedestrian-network';
import { blockedAreaSchema } from './routing';
import {
    INCIDENT_CATALOG,
    isIncidentType,
} from '../config/incident-catalog';
import type {
    IncidentEffect,
    IncidentType,
} from '../config/incident-catalog';

export const simulationIdSchema = z.string().uuid();

export const scenarioTimeSchema = z
    .string()
    .datetime({ offset: true });

const incidentTypeSchema = z.union([
    z.literal('blockage'),
    z.custom<IncidentType>(
        isIncidentType,
        'El tipo de incidente no es válido.',
    ),
]);

const incidentEffectSchema = z.enum([
    'informational',
    'caution',
    'blockage',
]);

export const createIncidentSchema = z.object({
    simulationId: simulationIdSchema,
    blockedArea: blockedAreaSchema.optional(),
    pedestrianSelection: pedestrianSelectionSchema.optional(),

    // Compatibilidad con el botón actual.
    type: incidentTypeSchema.default('blockage'),
    source: z
        .enum([
            'simulation',
            'manual',
            'ai_generated',
        ])
        .default('simulation'),

    description: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .optional(),

    effect: incidentEffectSchema.optional(),

    reporterName: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .optional(),

    durationMinutes: z
        .number()
        .int()
        .min(1)
        .max(30 * 24 * 60)
        .optional(),

    startsAt: scenarioTimeSchema.optional(),
}).superRefine((input, context) => {
    if (!input.blockedArea && !input.pedestrianSelection) {
        context.addIssue({ code: 'custom', message: 'Seleccioná una ubicación válida.' });
    }
    if (input.source === 'manual' && !input.pedestrianSelection) {
        context.addIssue({ code: 'custom', message: 'Seleccioná tramos de la red peatonal.' });
    }
});

export type Incident = {
    id: string;
    simulationId: string;
    type: IncidentType | 'blockage';
    source:
        | 'simulation'
        | 'manual'
        | 'ai_generated';
    description: string;
    effect: IncidentEffect;
    reporterName: string | null;
    blockedArea: z.infer<typeof blockedAreaSchema>;
    pedestrianImpact?: PedestrianImpact | null;
    createdAt: Date;
    startsAt: Date;
    expiresAt: Date;
};

export type IncidentStatus =
    | 'scheduled'
    | 'active'
    | 'finished';

export type ListedIncident = Incident & {
    status: IncidentStatus;
};

const incidentColumns = `
    id,
    simulation_id AS "simulationId",
    type,
    source,
    description,
    effect,
    reporter_name AS "reporterName",
    json_build_object(
        'south', south,
        'west', west,
        'north', north,
        'east', east
    ) AS "blockedArea",
    pedestrian_impact AS "pedestrianImpact",
    created_at AS "createdAt",
    starts_at AS "startsAt",
    expires_at AS "expiresAt"
`;

function resolveScenarioTime(value?: string): Date {
    return value === undefined
        ? new Date()
        : new Date(scenarioTimeSchema.parse(value));
}

export async function createIncident(
    value: unknown,
): Promise<Incident> {
    const input = createIncidentSchema.parse(value);

    const defaults =
        input.type === 'blockage'
            ? {
                  defaultDescription:
                      'Bloqueo registrado en la simulación.',
                  defaultDurationMinutes: 15,
                  defaultEffect: 'blockage' as const,
              }
            : INCIDENT_CATALOG[input.type];

    const description =
        input.description ?? defaults.defaultDescription;

    const effect =
        input.effect ?? defaults.defaultEffect;

    const durationMinutes =
        input.durationMinutes
        ?? defaults.defaultDurationMinutes;

    const reporterName =
        input.reporterName
        ?? (
            input.source === 'manual'
                ? 'Usuario'
                : input.source === 'ai_generated'
                  ? 'Flota simulada'
                  : 'Simulador'
        );

    const startsAt = resolveScenarioTime(input.startsAt);

    const expiresAt = new Date(
        startsAt.getTime() + durationMinutes * 60_000,
    );

    if (!Number.isFinite(expiresAt.getTime())) {
        throw new Error(
            'La fecha de finalización está fuera del rango permitido.',
        );
    }

    const impact = input.pedestrianSelection
        ? resolvePedestrianSelection(input.pedestrianSelection) : null;
    const { south, west, north, east } = impact ? impactBounds(impact) : input.blockedArea!;

    const result = await pool.query<Incident>(
        `
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
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING ${incidentColumns}
        `,
        [
            randomUUID(),
            input.simulationId,
            input.type,
            input.source,
            description,
            effect,
            reporterName,
            south,
            west,
            north,
            east,
            startsAt,
            expiresAt,
            impact ? JSON.stringify(impact) : null,
        ],
    );

    const incident = result.rows[0];

    if (!incident) {
        throw new Error(
            'La base no devolvió el incidente registrado.',
        );
    }

    return incident;
}

// Consulta para el mapa y el historial.
// Incluye todos los efectos.
export async function listIncidents(
    simulationId: string,
    options: {
        scenarioTime?: string;
        includeHistory?: boolean;
    } = {},
): Promise<ListedIncident[]> {
    const validId =
        simulationIdSchema.parse(simulationId);

    const scenarioTime =
        resolveScenarioTime(options.scenarioTime);

    const includeHistory =
        options.includeHistory ?? false;

    const result = await pool.query<ListedIncident>(
        `
        SELECT
            ${incidentColumns},
            CASE
                WHEN starts_at > $2::timestamptz
                    THEN 'scheduled'
                WHEN expires_at <= $2::timestamptz
                    THEN 'finished'
                ELSE 'active'
            END AS status
        FROM incidents
        WHERE simulation_id = $1
          AND (
              $3::boolean
              OR (
                  starts_at <= $2::timestamptz
                  AND expires_at > $2::timestamptz
              )
          )
        ORDER BY starts_at DESC, id
        `,
        [
            validId,
            scenarioTime,
            includeHistory,
        ],
    );

    return result.rows;
}

// Conservamos esta función para las herramientas MCP.
// Solo devuelve incidentes que realmente bloquean.
export async function listActiveIncidents(
    simulationId: string,
    scenarioTime?: string,
): Promise<Incident[]> {
    const validId =
        simulationIdSchema.parse(simulationId);

    const at = resolveScenarioTime(scenarioTime);

    const result = await pool.query<Incident>(
        `
        SELECT ${incidentColumns}
        FROM incidents
        WHERE simulation_id = $1
          AND starts_at <= $2::timestamptz
          AND expires_at > $2::timestamptz
          AND effect = 'blockage'
        ORDER BY created_at DESC, id
        `,
        [
            validId,
            at,
        ],
    );

    return result.rows;
}