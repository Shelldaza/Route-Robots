import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';

export const robotsRouter = Router();

const createRobotSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),
    modelId: z.uuid(),
});

const robotColumns = `
    r.id,
    r.name,
    r.model_id AS "modelId",
    m.name AS model,
    m.speed_kmh AS "speedKmh",
    m.battery_capacity_wh AS "batteryCapacityWh",
    m.consumption_wh_per_km AS "consumptionWhPerKm",
    m.max_slope_percent AS "maxSlopePercent",
    m.width_meters AS "widthMeters",
    m.length_meters AS "lengthMeters",
    m.lateral_margin_meters AS "lateralMarginMeters",
    m.data_source AS "dataSource",
    m.source_notes AS "sourceNotes",
    r.created_at AS "createdAt"
`;

robotsRouter.get('/', async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT ${robotColumns}
            FROM robots r
            JOIN robot_models m ON m.id = r.model_id
            ORDER BY r.created_at DESC, r.id DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(
            'Error al consultar robots:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudieron consultar los robots.',
        });
    }
});

robotsRouter.post('/', async (req, res) => {
    const validation = createRobotSchema.safeParse(req.body);

    if (!validation.success) {
        res.status(400).json({
            message: 'Los datos del robot son inválidos.',
            errors: validation.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });

        return;
    }

    const robot = validation.data;

    try {
        // INSERT ... SELECT comprueba que el modelo exista.
        // La unidad solamente guarda su identificador y model_id.
        const result = await pool.query(
            `
                WITH inserted AS (
                    INSERT INTO robots (name, model_id)
                    SELECT $1, id FROM robot_models WHERE id = $2
                    RETURNING *
                )
                SELECT ${robotColumns}
                FROM inserted r
                JOIN robot_models m ON m.id = r.model_id
            `,
            [robot.name, robot.modelId],
        );

        if (!result.rows[0]) {
            res.status(404).json({
                message: 'El modelo seleccionado no existe.',
            });

            return;
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (
            error
            && typeof error === 'object'
            && 'code' in error
            && error.code === '23505'
        ) {
            res.status(409).json({
                message:
                    'Ya existe un robot con ese nombre o identificador.',
            });

            return;
        }

        console.error(
            'Error al registrar robot:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudo registrar el robot.',
        });
    }
});