import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db';
import { blockedAreaSchema } from './routing';

export const simulationIdSchema = z.string().uuid();

export const createIncidentSchema = z.object({
    simulationId: simulationIdSchema,
    blockedArea: blockedAreaSchema,
});

type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export type Incident = {
    id: string;
    simulationId: string;
    type: 'blockage';
    source: 'simulation';
    blockedArea: z.infer<typeof blockedAreaSchema>;
    createdAt: Date;
    expiresAt: Date;
};

const incidentColumns = `
    id,
    simulation_id AS "simulationId",
    type,
    source,
    json_build_object(
        'south', south,
        'west', west,
        'north', north,
        'east', east
    ) AS "blockedArea",
    created_at AS "createdAt",
    expires_at AS "expiresAt"
`;

export async function createIncident(
    value: CreateIncidentInput,
): Promise<Incident> {
    const input = createIncidentSchema.parse(value);
    const { south, west, north, east } = input.blockedArea;

    const result = await pool.query<Incident>(
        `
        INSERT INTO incidents (
            id,
            simulation_id,
            south,
            west,
            north,
            east
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${incidentColumns}
        `,
        [
            randomUUID(),
            input.simulationId,
            south,
            west,
            north,
            east,
        ],
    );

    const incident = result.rows[0];

    if (!incident) {
        throw new Error('La base no devolvió el incidente registrado.');
    }

    return incident;
}

export async function listActiveIncidents(
    simulationId: string,
): Promise<Incident[]> {
    const validId = simulationIdSchema.parse(simulationId);

    const result = await pool.query<Incident>(
        `
        SELECT ${incidentColumns}
        FROM incidents
        WHERE simulation_id = $1
          AND expires_at > NOW()
        ORDER BY created_at DESC, id
        `,
        [validId],
    );

    return result.rows;
}