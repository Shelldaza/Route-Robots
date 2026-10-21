import { pool } from '../db';

import type {
    SurfaceReportToInsert,
} from '../types/surfaces';

// Señala que el ID existe pero no corresponde al mismo reporte.
// El servicio lo transforma en el error público de conflicto.
export class SurfaceReportConflictError extends Error {
    constructor() {
        super('Ese identificador ya pertenece a otro reporte.');
        this.name = 'SurfaceReportConflictError';
    }
}

// Las dos escrituras utilizan un único cliente y una única transacción.
// El servicio prepara las fechas, el efecto y los límites antes de llamar aquí.
export async function insertSurfaceReport(
    input: SurfaceReportToInsert,
) {
    const client = await pool.connect();

    let rollbackFailure: Error | undefined;

    const {
        blockedArea: bounds,
        startsAt: starts,
        expiresAt: expires,
        pedestrianImpact,
        impact,
    } = input;

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
            input.effect,
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
            // La geometría se guarda dentro de la misma transacción.
            // Si esta escritura falla, también se revierte el incidente.
            await client.query(`
                INSERT INTO incident_surfaces (incident_id, impact)
                VALUES ($1, $2)
            `, [
                input.id,
                JSON.stringify(impact),
            ]);
        } else {
            // Puede ser un reintento de una solicitud ya guardada.
            // El mismo ID solo se acepta si corresponde al mismo reporte.
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
                input.effect,
            ]);

            if (!previous.rows.length) {
                throw new SurfaceReportConflictError();
            }
        }

        await client.query('COMMIT');

        return {
            id: input.id,
            simulationId: input.simulationId,
        };
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            // La conexión no debe volver al pool si no se pudo revertir.
            //
            // Guardamos este segundo fallo sin reemplazar el error
            // que provocó originalmente el rechazo de la operación.
            rollbackFailure = rollbackError instanceof Error
                ? rollbackError
                : new Error(
                    'No se pudo revertir la transacción.',
                    {
                        cause: rollbackError,
                    },
                );
        }

        throw error;
    } finally {
        if (rollbackFailure) {
            // Pasar el error a release descarta la conexión del pool.
            client.release(rollbackFailure);
        } else {
            client.release();
        }
    }
}