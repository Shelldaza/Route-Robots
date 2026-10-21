// Pruebas de compilación: no hacen solicitudes ni generan
// código ejecutable.
//
// tsc debe fallar si se mezclan registros de PostgreSQL
// y respuestas JSON.

import type {
    z,
} from 'zod';

import type {
    Incident,
} from './incidents';

import type {
    IncidentDTO,
} from '../../../shared/contracts/incidents';

import type {
    Bounds,
    GeographicPoint,
} from '../../../shared/contracts/geography';

import type {
    PedestrianSelection,
} from '../../../shared/contracts/pedestrian';

import type {
    pointSchema,
    blockedAreaSchema,
} from '../schemas/routing';

import type {
    pedestrianSelectionSchema,
} from '../services/pedestrian-network';

type Expect<T extends true> = T;

type Equal<A, B> =
    [A] extends [B]
        ? [B] extends [A]
            ? true
            : false
        : false;

type Assignable<A, B> =
    [A] extends [B]
        ? true
        : false;

type DateKeys =
    | 'createdAt'
    | 'startsAt'
    | 'expiresAt';

// Forma del registro una vez serializadas sus fechas.
type SerializedIncident =
    Omit<Incident, DateKeys>
    & Pick<IncidentDTO, DateKeys>;

export type ContractTypeChecks = [
    Expect<
        Equal<
            Pick<Incident, DateKeys>,
            {
                createdAt: Date;
                startsAt: Date;
                expiresAt: Date;
            }
        >
    >,

    Expect<
        Equal<
            Pick<IncidentDTO, DateKeys>,
            {
                createdAt: string;
                startsAt: string;
                expiresAt: string;
            }
        >
    >,

    Expect<
        Equal<
            Assignable<Incident, IncidentDTO>,
            false
        >
    >,

    Expect<
        Equal<
            Assignable<IncidentDTO, Incident>,
            false
        >
    >,

    Expect<
        Assignable<
            SerializedIncident,
            IncidentDTO
        >
    >,

    Expect<
        Equal<
            z.infer<typeof pointSchema>,
            GeographicPoint
        >
    >,

    Expect<
        Equal<
            z.infer<typeof blockedAreaSchema>,
            Bounds
        >
    >,

    Expect<
        Equal<
            z.infer<typeof pedestrianSelectionSchema>,
            PedestrianSelection
        >
    >,
];