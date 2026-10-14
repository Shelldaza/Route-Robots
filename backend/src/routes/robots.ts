import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';

export const robotsRouter = Router();

const createRobotSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),

    model: z.string()
        .trim()
        .max(80)
        .nullable()
        .optional()
        .transform((value) => value || null),

    speedKmh: z.number().positive(),

    batteryCapacityWh: z.number().positive(),

    consumptionWhPerKm: z.number().positive(),

    maxSlopePercent: z.number()
        .nonnegative()
        .nullable()
        .optional()
        .transform((value) => value ?? null),
});

type RobotRow = {
    id: string;
    name: string;
    model: string | null;
    speedKmh: number;
    batteryCapacityWh: number;
    consumptionWhPerKm: number;
    maxSlopePercent: number | null;
    createdAt: Date;
};

const robotColumns = `
    id,
    name,
    model,
    speed_kmh AS "speedKmh",
    battery_capacity_wh AS "batteryCapacityWh",
    consumption_wh_per_km AS "consumptionWhPerKm",
    max_slope_percent AS "maxSlopePercent",
    created_at AS "createdAt"
`;

// Consultar los robots registrados.
robotsRouter.get('/', async (_req, res) => {
    try {
        const result = await pool.query<RobotRow>(`
            SELECT ${robotColumns}
            FROM robots
            ORDER BY created_at DESC, id DESC
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(
            'Error al consultar robots:',
            error instanceof Error ? error.message : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudieron consultar los robots.',
        });
    }
});

// Registrar un robot.
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
        const result = await pool.query<RobotRow>(
            `
                INSERT INTO robots (
                    name,
                    model,
                    speed_kmh,
                    battery_capacity_wh,
                    consumption_wh_per_km,
                    max_slope_percent
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING ${robotColumns}
            `,
            [
                robot.name,
                robot.model,
                robot.speedKmh,
                robot.batteryCapacityWh,
                robot.consumptionWhPerKm,
                robot.maxSlopePercent,
            ],
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === '23505'
        ) {
            res.status(409).json({
                message: 'Ya existe un robot con ese nombre o identificador.',
            });

            return;
        }

        console.error(
            'Error al registrar robot:',
            error instanceof Error ? error.message : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudo registrar el robot.',
        });
    }
});