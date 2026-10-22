import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
    pedestrianSelectionSchema,
    resolvePedestrianSelection,
    impactBounds,
} from './pedestrian-network';

import {
    blockedAreaSchema,
} from './routing';

import {
    INCIDENT_CATALOG,
    isIncidentType,
} from '../config/incident-catalog';

import type {
    IncidentType,
} from '../config/incident-catalog';

import type {
    Incident,
    ListedIncident,
} from '../types/incidents';

import {
    insertIncident,
    findIncidents,
    findActiveBlockages,
    findIncidentById as findStoredIncidentById,
} from '../repositories/incidents';

// Conservamos los exports anteriores para que los endpoints, las herramientas
// MCP y los tests puedan seguir importando estos tipos desde este servicio.
export type {
    Incident,
    IncidentStatus,
    ListedIncident,
} from '../types/incidents';

// El servicio valida los datos antes de entregarlos al repositorio.
// Las consultas SQL quedan concentradas en repositories/incidents.ts.
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

    pedestrianSelection:
        pedestrianSelectionSchema.optional(),

    // 'blockage' conserva compatibilidad con reportes antiguos
    // creados desde la simulación.
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
        context.addIssue({
            code: 'custom',
            message: 'Seleccioná una ubicación válida.',
        });
    }

    // Este servicio conserva el contrato de los reportes manuales por tramo.
    // Los reportes de superficies tienen su propio flujo de validación.
    if (
        input.source === 'manual'
        && !input.pedestrianSelection
    ) {
        context.addIssue({
            code: 'custom',
            message: 'Seleccioná tramos de la red peatonal.',
        });
    }
});

function resolveScenarioTime(value?: string): Date {
    // Si recibimos una fecha del escenario, esa fecha determina la vigencia.
    // Solo usamos la hora real cuando el llamador no envía una fecha.
    return value === undefined
        ? new Date()
        : new Date(scenarioTimeSchema.parse(value));
}

export async function createIncident(
    value: unknown,
    id: string = randomUUID(),
): Promise<Incident> {
    const input = createIncidentSchema.parse(value);

    simulationIdSchema.parse(id);

    // El catálogo propone valores. Una elección explícita del usuario
    // conserva prioridad sobre esas propuestas.
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

    // La selección contiene identificadores de tramos.
    // Su geometría se resuelve con la red del servidor, evitando confiar
    // en coordenadas inventadas o correspondientes a otra versión.
    const impact = input.pedestrianSelection
        ? resolvePedestrianSelection(input.pedestrianSelection)
        : null;

    const {
        south,
        west,
        north,
        east,
    } = impact
        ? impactBounds(impact)
        : input.blockedArea!;

    // Llegamos al repositorio con los datos validados y preparados.
    // El repositorio únicamente se encarga de persistirlos.
    return insertIncident({
        id,
        simulationId: input.simulationId,
        type: input.type,
        source: input.source,
        description,
        effect,
        reporterName,
        blockedArea: {
            south,
            west,
            north,
            east,
        },
        pedestrianImpact: impact,
        startsAt,
        expiresAt,
    });
}

// El mapa y el historial incluyen todos los efectos.
export async function listIncidents(
    simulationId: string,
    options: {
        scenarioTime?: string;
        includeHistory?: boolean;
    } = {},
): Promise<ListedIncident[]> {
    const validId = simulationIdSchema.parse(simulationId);

    const at = resolveScenarioTime(options.scenarioTime);

    return findIncidents(
        validId,
        at,
        options.includeHistory ?? false,
    );
}

// Las herramientas MCP que usan este servicio reciben solo bloqueos activos.
// La selección temporal se hace con la fecha del escenario indicada.
export async function listActiveIncidents(
    simulationId: string,
    scenarioTime?: string,
): Promise<Incident[]> {
    const validId = simulationIdSchema.parse(simulationId);

    const at = resolveScenarioTime(scenarioTime);

    return findActiveBlockages(validId, at);
}

export async function findIncidentById(
    id: string,
): Promise<Incident | null> {
    return findStoredIncidentById(
        simulationIdSchema.parse(id),
    );
}