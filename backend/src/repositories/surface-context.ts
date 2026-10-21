import { pool } from '../db';

import type {
    SurfaceContext,
} from '../types/surfaces';

const contextColumns = `
    simulation_id AS "simulationId",
    robot_id AS "robotId",
    network_version AS "networkVersion",
    width_meters AS "widthMeters",
    lateral_margin_meters AS "lateralMarginMeters"
`;

export async function findSurfaceContext(
    simulationId: string,
): Promise<SurfaceContext | null> {
    const result = await pool.query<SurfaceContext>(`
        SELECT ${contextColumns}
        FROM surface_scenarios
        WHERE simulation_id = $1
    `, [simulationId]);

    return result.rows[0] ?? null;
}

export async function insertSurfaceContext(
    input: Pick<
        SurfaceContext,
        'simulationId' | 'robotId' | 'networkVersion'
    >,
): Promise<void> {
    // Las dimensiones se leen del modelo guardado, no del cliente.
    //
    // Si el escenario ya existe, ON CONFLICT conserva su copia original.
    // El servicio comprobará después que corresponda al mismo robot y red.
    await pool.query(`
        INSERT INTO surface_scenarios (
            simulation_id,
            robot_id,
            network_version,
            width_meters,
            lateral_margin_meters
        )
        SELECT
            $1,
            r.id,
            $3,
            m.width_meters,
            m.lateral_margin_meters
        FROM robots r
        JOIN robot_models m ON m.id = r.model_id
        WHERE r.id = $2
        ON CONFLICT (simulation_id) DO NOTHING
    `, [
        input.simulationId,
        input.robotId,
        input.networkVersion,
    ]);
}