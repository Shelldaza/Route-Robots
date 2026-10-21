import { pool } from '../db';

import type {
    Incident,
    IncidentToInsert,
    ListedIncident,
} from '../types/incidents';

// Este módulo concentra el SQL de los incidentes.
//
// Recibe datos ya validados por el servicio. No interpreta solicitudes HTTP,
// no aplica valores del catálogo ni calcula la duración de un incidente.

// Esta proyección convierte los nombres de columnas de PostgreSQL
// a los nombres de propiedades que utiliza el backend.
//
// Se reutiliza para que todas las consultas devuelvan la misma estructura.
const incidentColumns = `
    id,
    simulation_id AS "simulationId",
    type,
    source,
    description,
    effect,
    reporter_name AS "reporterName",
    json_build_object(
        'south', south,
        'west', west,
        'north', north,
        'east', east
    ) AS "blockedArea",
    pedestrian_impact AS "pedestrianImpact",
    created_at AS "createdAt",
    starts_at AS "startsAt",
    expires_at AS "expiresAt"
`;

export async function insertIncident(
    incident: IncidentToInsert,
): Promise<Incident> {
    const { id } = incident;

    const {
        south,
        west,
        north,
        east,
    } = incident.blockedArea;

    // Se conserva el comportamiento anterior para reintentos con el mismo ID:
    // se devuelve el registro existente sin reemplazar sus datos.
    //
    // Los valores se envían como parámetros. Nunca se concatenan descripciones
    // o identificadores recibidos del usuario dentro del texto SQL.
    const result = await pool.query<Incident>(
        `
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
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
        RETURNING ${incidentColumns}
        `,
        [
            id,
            incident.simulationId,
            incident.type,
            incident.source,
            incident.description,
            incident.effect,
            incident.reporterName,
            south,
            west,
            north,
            east,
            incident.startsAt,
            incident.expiresAt,
            incident.pedestrianImpact
                ? JSON.stringify(incident.pedestrianImpact)
                : null,
        ],
    );

    const saved = result.rows[0];

    if (!saved) {
        throw new Error(
            'La base no devolvió el incidente registrado.',
        );
    }

    return saved;
}

export async function findIncidents(
    simulationId: string,
    scenarioTime: Date,
    includeHistory: boolean,
): Promise<ListedIncident[]> {
    // Un incidente está activo cuando:
    // startsAt <= fecha del escenario < expiresAt.
    //
    // Con includeHistory también devolvemos los incidentes programados
    // y los finalizados, indicando su estado para esa misma fecha.
    const result = await pool.query<ListedIncident>(
        `
        SELECT
            ${incidentColumns},
            CASE
                WHEN starts_at > $2::timestamptz
                    THEN 'scheduled'
                WHEN expires_at <= $2::timestamptz
                    THEN 'finished'
                ELSE 'active'
            END AS status
        FROM incidents
        WHERE simulation_id = $1
          AND (
              $3::boolean
              OR (
                  starts_at <= $2::timestamptz
                  AND expires_at > $2::timestamptz
              )
          )
        ORDER BY starts_at DESC, id
        `,
        [
            simulationId,
            scenarioTime,
            includeHistory,
        ],
    );

    return result.rows;
}

export async function findActiveBlockages(
    simulationId: string,
    at: Date,
): Promise<Incident[]> {
    // Esta consulta tiene un propósito distinto al historial:
    // devuelve únicamente bloqueos vigentes para evaluar desvíos.
    //
    // Los incidentes informativos y las precauciones siguen disponibles
    // mediante findIncidents, pero no se convierten aquí en cierres.
    const result = await pool.query<Incident>(
        `
        SELECT ${incidentColumns}
        FROM incidents
        WHERE simulation_id = $1
          AND starts_at <= $2::timestamptz
          AND expires_at > $2::timestamptz
          AND effect = 'blockage'
        ORDER BY created_at DESC, id
        `,
        [
            simulationId,
            at,
        ],
    );

    return result.rows;
}

export async function findIncidentById(
    id: string,
): Promise<Incident | null> {
    const result = await pool.query<Incident>(
        `
        SELECT ${incidentColumns}
        FROM incidents
        WHERE id = $1
        `,
        [id],
    );

    return result.rows[0] ?? null;
}