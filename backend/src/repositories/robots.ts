import { pool } from '../db';

import type {
    Robot,
} from '../../../shared/contracts/robots';

import type {
    CreateRobotInput,
} from '../schemas/robots';

// El contrato HTTP usa texto ISO. Dentro del backend, pg devuelve Date.
type StoredRobot = Omit<Robot, 'createdAt'> & {
    createdAt: Date;
};

// Las capacidades se leen del modelo; no se duplican en cada unidad.
//
// Los alias convierten los nombres de columnas de PostgreSQL a los nombres
// de propiedades que utiliza la API.
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

export async function findRobots(): Promise<StoredRobot[]> {
    const result = await pool.query<StoredRobot>(`
        SELECT ${robotColumns}
        FROM robots r
        JOIN robot_models m ON m.id = r.model_id
        ORDER BY r.created_at DESC, r.id DESC
    `);

    return result.rows;
}

export async function insertRobot(
    robot: CreateRobotInput,
): Promise<StoredRobot | null> {
    // Comprobar el modelo e insertar la unidad sucede en una sola sentencia.
    // No hacemos un SELECT previo que pueda quedar desactualizado antes
    // del INSERT.
    //
    // Los valores se envían como parámetros, sin concatenarlos al SQL.
    const result = await pool.query<StoredRobot>(
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

    // Si el modelo no existe, INSERT ... SELECT no inserta ninguna fila.
    return result.rows[0] ?? null;
}