import {
  pool,
} from '../db';

import type {
  IncidentDTO,
  IncidentSummaryDTO,
  IncidentSnapshotDTO,
} from '../../../shared/contracts/incidents';

// La proyección ocurre en PostgreSQL.
// No descargamos superficies de contexto para luego descartarlas en Node.
export async function readIncidentSnapshot(
  simulationId: string,
  at: string,
): Promise<IncidentSnapshotDTO> {
  const { rows } = await pool.query<
    IncidentDTO & {
      placementKind: IncidentSummaryDTO['placementKind'];
      active: boolean;
    }
  >(`
    SELECT
      i.id,
      i.simulation_id AS "simulationId",
      i.type,
      i.source,
      i.description,
      i.effect,
      i.reporter_name AS "reporterName",

      to_jsonb(i.created_at) #>> '{}' AS "createdAt",
      to_jsonb(i.starts_at) #>> '{}' AS "startsAt",
      to_jsonb(i.expires_at) #>> '{}' AS "expiresAt",

      (
        i.starts_at <= $2::timestamptz
        AND i.expires_at > $2::timestamptz
      ) AS active,

      CASE
        WHEN s.incident_id IS NOT NULL THEN 'surface'
        WHEN i.pedestrian_impact IS NOT NULL THEN 'segment'
        ELSE 'area'
      END AS "placementKind",

      jsonb_build_object(
        'south', i.south,
        'west', i.west,
        'north', i.north,
        'east', i.east
      ) AS "blockedArea",

      CASE
        WHEN i.starts_at <= $2::timestamptz
          AND i.expires_at > $2::timestamptz
          AND s.incident_id IS NULL
        THEN i.pedestrian_impact
        ELSE NULL
      END AS "pedestrianImpact",

      CASE
        WHEN i.starts_at <= $2::timestamptz
          AND i.expires_at > $2::timestamptz
          AND s.incident_id IS NOT NULL
        THEN jsonb_build_object(
          'representation', 'map',
          'geometry', s.impact->'geometry',
          'collisionGeometry', s.impact->'collisionGeometry'
        )
        ELSE NULL
      END AS "surfaceImpact"

    FROM incidents i

    LEFT JOIN incident_surfaces s
      ON s.incident_id = i.id

    WHERE i.simulation_id = $1

    ORDER BY i.starts_at DESC, i.id
  `, [simulationId, at]);

  const history: IncidentSummaryDTO[] = rows.map(
    (row) => ({
      id: row.id,
      simulationId: row.simulationId,
      type: row.type,
      source: row.source,
      description: row.description,
      effect: row.effect,
      reporterName: row.reporterName,
      createdAt: row.createdAt,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      placementKind: row.placementKind,
    }),
  );

  const active: IncidentDTO[] = rows
    .filter((row) => row.active)
    .map(
      ({
        active: _active,
        placementKind: _kind,
        ...incident
      }) => incident,
    );

  return { history, active };
}
