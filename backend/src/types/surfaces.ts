import type {
    Incident,
} from './incidents';

import type {
    SurfaceImpact,
} from '../../../shared/surfaces';

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