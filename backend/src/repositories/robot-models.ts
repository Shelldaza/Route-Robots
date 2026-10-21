import { pool } from '../db';

import type {
    RobotModel,
} from '../../../shared/contracts/robots';

import type {
    CreateRobotModelInput,
} from '../schemas/robot-models';

// PostgreSQL devuelve Date; el contrato JSON compartido utiliza texto ISO.
type StoredRobotModel = Omit<RobotModel, 'createdAt'> & {
    createdAt: Date;
};

// El repositorio contiene SQL y devuelve filas.
// Las reglas sobre dimensiones y procedencia se validan antes de llegar aquí.
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

export async function findRobotModels(): Promise<StoredRobotModel[]> {
    const result = await pool.query<StoredRobotModel>(`
        SELECT ${modelColumns}
        FROM robot_models
        ORDER BY LOWER(name), id
    `);

    return result.rows;
}

export async function insertRobotModel(
    model: CreateRobotModelInput,
): Promise<StoredRobotModel> {
    // Los valores se pasan como parámetros, sin concatenarlos al SQL.
    const result = await pool.query<StoredRobotModel>(
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

    const saved = result.rows[0];

    // INSERT ... RETURNING debe devolver el registro.
    // Si no sucede, no comunicamos que el alta se completó correctamente.
    if (!saved) {
        throw new Error(
            'La base no devolvió el modelo registrado.',
        );
    }

    return saved;
}