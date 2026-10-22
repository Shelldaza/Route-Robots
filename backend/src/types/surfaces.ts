import type {
    Incident,
} from './incidents';

import type { SurfaceImpact, Box } from '../../../shared/contracts/surfaces'

export type SurfaceIncident = Incident & {
    surfaceImpact?: SurfaceImpact | null;
};

// Copia de las dimensiones utilizadas por este escenario.
//
// Las evaluaciones posteriores utilizan estos valores persistidos.
// No sustituyen automáticamente las medidas por cambios del catálogo.
export type SurfaceContext = {
    simulationId: string;
    robotId: string;
    networkVersion: string;
    widthMeters: number | null;
    lateralMarginMeters: number | null;
};

// Datos ya preparados por el servicio para guardar ambas tablas.
//
// La caja se conserva aparte porque también identifica los reintentos.
// El repositorio no vuelve a calcular geometrías, límites ni fechas.
export type SurfaceReportToInsert = Pick<
    Incident,
    | 'id'
    | 'simulationId'
    | 'type'
    | 'description'
    | 'effect'
    | 'blockedArea'
    | 'startsAt'
    | 'expiresAt'
> & {
    pedestrianImpact:
        NonNullable<Incident['pedestrianImpact']> | null;

    impact: SurfaceImpact;
    box: Box;
};