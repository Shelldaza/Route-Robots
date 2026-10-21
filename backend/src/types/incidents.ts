import type { IncidentData, IncidentStatus } from '../../../shared/contracts/incidents';

export type { IncidentStatus } from '../../../shared/contracts/incidents';

// Registro interno: PostgreSQL devuelve estas fechas como Date.
export type Incident = IncidentData & {
    createdAt: Date;
    startsAt: Date;
    expiresAt: Date;
};

export type ListedIncident = Incident & {
    status: IncidentStatus;
};

export type IncidentToInsert = Omit<Incident, 'createdAt'>;
