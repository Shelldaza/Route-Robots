import type {
    IncidentEffect,
    IncidentType,
} from '../config/incident-catalog';

import type {
    PedestrianImpact,
} from '../services/pedestrian-network';

import type {
    BlockedArea,
} from '../services/routing';

// Representación interna del backend.
//
// PostgreSQL devuelve estas fechas como objetos Date.
// Al responder por HTTP, Express las serializa como texto ISO.
// Por eso este tipo no se comparte directamente con el frontend.
export type Incident = {
    id: string;
    simulationId: string;
    type: IncidentType | 'blockage';

    source:
        | 'simulation'
        | 'manual'
        | 'ai_generated';

    description: string;
    effect: IncidentEffect;
    reporterName: string | null;
    blockedArea: BlockedArea;
    pedestrianImpact?: PedestrianImpact | null;

    createdAt: Date;
    startsAt: Date;
    expiresAt: Date;
};

export type IncidentStatus =
    | 'scheduled'
    | 'active'
    | 'finished';

export type ListedIncident = Incident & {
    status: IncidentStatus;
};

// El servicio prepara todos los datos del incidente salvo createdAt,
// que se asigna al guardar el registro en PostgreSQL.
export type IncidentToInsert = Omit<Incident, 'createdAt'>;