import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';

export const robotModelsRouter = Router();

const optionalPositive = z.number()
    .finite()
    .positive()
    .nullish()
    .transform((value) => value ?? null);

const optionalNonnegative = z.number()
    .finite()
    .nonnegative()
    .nullish()
    .transform((value) => value ?? null);

const createModelSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),

    speedKmh: z.number().finite().positive(),

    batteryCapacityWh: z.number().finite().positive(),

    consumptionWhPerKm: z.number().finite().positive(),

    maxSlopePercent: optionalNonnegative,

    widthMeters: optionalPositive,

    lengthMeters: optionalPositive,

    lateralMarginMeters: optionalNonnegative,

    dataSource: z.enum([
        'simulated',
        'documented',
        'measured',
        'unknown',
    ]),

    sourceNotes: z.string()
        .trim()
        .max(500)
        .nullish()
        .transform((value) => value || null),
}).superRefine((value, context) => {
    if (
        ['documented', 'measured'].includes(value.dataSource)
        && !value.sourceNotes
    ) {
        context.addIssue({
            code: 'custom',
            path: ['sourceNotes'],
            message:
                'Indicá el documento o las condiciones de medición.',
        });
    }
});

const modelColumns = `
    id,
    name,
    speed_kmh AS "speedKmh",
    battery_capacity_wh AS "batteryCapacityWh",
    consumption_wh_per_km AS "consumptionWhPerKm",
    max_slope_percent AS "maxSlopePercent",
    width_meters AS "widthMeters",
    length_meters AS "lengthMeters",
    lateral_margin_meters AS "lateralMarginMeters",
    data_source AS "dataSource",
    source_notes AS "sourceNotes",
    created_at AS "createdAt"
`;

robotModelsRouter.get('/', async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT ${modelColumns}
            FROM robot_models
            ORDER BY LOWER(name), id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(
            'Error al consultar modelos:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudieron consultar los modelos.',
        });
    }
});

// Cada entrada representa una configuración.
// Para otra configuración se crea otro modelo.
robotModelsRouter.post('/', async (req, res) => {
    const validation = createModelSchema.safeParse(req.body);

    if (!validation.success) {
        res.status(400).json({
            message: 'Los datos del modelo son inválidos.',
            errors: validation.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });

        return;
    }

    const model = validation.data;

    try {
        const result = await pool.query(
            `
                INSERT INTO robot_models (
                    name,
                    speed_kmh,
                    battery_capacity_wh,
                    consumption_wh_per_km,
                    max_slope_percent,
                    width_meters,
                    length_meters,
                    lateral_margin_meters,
                    data_source,
                    source_notes
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                RETURNING ${modelColumns}
            `,
            [
                model.name,
                model.speedKmh,
                model.batteryCapacityWh,
                model.consumptionWhPerKm,
                model.maxSlopePercent,
                model.widthMeters,
                model.lengthMeters,
                model.lateralMarginMeters,
                model.dataSource,
                model.sourceNotes,
            ],
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (
            error
            && typeof error === 'object'
            && 'code' in error
            && error.code === '23505'
        ) {
            res.status(409).json({
                message: 'Ya existe un modelo con ese nombre.',
            });

            return;
        }

        console.error(
            'Error al registrar modelo:',
            error instanceof Error
                ? error.message
                : 'Error desconocido',
        );

        res.status(500).json({
            message: 'No se pudo registrar el modelo.',
        });
    }
});