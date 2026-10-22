import {
  pool,
} from '../db';

import {
  findIncidentById,
} from './incidents';

import {
  RoutingError,
} from './routing';

import type {
  SurfaceImpact,
} from '../../../shared/contracts/surfaces';

// Consulta un único reporte completo.
// No reconstruye primero todo el historial del escenario.
export async function readSurfaceIncidentDetail(
  simulationId: string,
  id: string,
) {
  const incident = await findIncidentById(id);

  if (
    !incident
    || incident.simulationId !== simulationId
  ) {
    throw new RoutingError(
      404,
      'No se encontró el reporte en este escenario.',
    );
  }

  const { rows } = await pool.query<{
    impact: SurfaceImpact;
  }>(
    'SELECT impact FROM incident_surfaces WHERE incident_id = $1',
    [id],
  );

  return {
    ...incident,
    surfaceImpact: rows[0]?.impact ?? null,
  };
}
