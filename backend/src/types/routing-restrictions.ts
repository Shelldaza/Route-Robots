import type {
    Incident,
} from './incidents';

import type {
    SurfaceIncident,
} from './surfaces';

import type {
    BlockedArea,
} from './routing';

/**
 * El campo kind permite distinguir el alcance sin interpretar
 * excepciones ni utilizar listas vacías como señal.
 */
export type RoutingRestriction =
    | {
        kind: 'area';
        bounds: BlockedArea;
    }
    | {
        kind: 'segments';
        networkVersion: string;
        segmentIds: string[];
    }
    | {
        kind: 'surface';
        networkVersion: string;
    };

/**
 * Conserva los metadatos del incidente.
 *
 * La ubicación utilizada para enrutar queda representada
 * exclusivamente por restriction.
 */
export type RoutingIncident = Omit<
    Incident,
    'blockedArea' | 'pedestrianImpact'
> & {
    restriction: RoutingRestriction;
};

/**
 * Compatibilidad con los servicios existentes.
 *
 * Pueden entregar registros de PostgreSQL o incidentes que
 * ya fueron convertidos a restricciones explícitas.
 */
export type RoutingIncidentInput =
    | SurfaceIncident
    | RoutingIncident;