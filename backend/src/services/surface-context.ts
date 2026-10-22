import { z } from 'zod';

import {
    RoutingError,
} from './routing-error';

import {
    pedestrianNetwork,
} from './pedestrian-network';

import {
    findSurfaceContext,
    insertSurfaceContext,
} from '../repositories/surface-context';

import type {
    SurfaceContext,
} from '../types/surfaces';

export const contextSchema = z.strictObject({
    simulationId: z.uuid(),
    robotId: z.uuid(),
    networkVersion: z.string().min(1),
});

// Recupera la copia persistida del escenario.
//
// No consulta las medidas actuales del modelo ni sustituye dimensiones
// desconocidas por valores supuestos.
export async function getSurfaceContext(
    simulationId: string,
): Promise<SurfaceContext | null> {
    return findSurfaceContext(simulationId);
}

// Repetir el registro conserva la asociación y las dimensiones originales.
// El router valida el cuerpo HTTP con contextSchema antes de llamar al servicio.
export async function registerSurfaceContext(
    input: z.infer<typeof contextSchema>,
): Promise<SurfaceContext> {
    if (
        input.networkVersion
        !== pedestrianNetwork.version
    ) {
        throw new RoutingError(
            409,
            'La red cambió. Iniciá un escenario nuevo.',
        );
    }

    await insertSurfaceContext(input);

    const context = await getSurfaceContext(
        input.simulationId,
    );

    if (!context) {
        throw new RoutingError(
            404,
            'El robot no existe.',
        );
    }

    // La inserción no modifica un escenario existente.
    // Por eso comprobamos también la asociación recuperada de PostgreSQL.
    if (
        context.robotId !== input.robotId
        || context.networkVersion !== input.networkVersion
    ) {
        throw new RoutingError(
            409,
            'El escenario ya tiene otro robot o red.',
        );
    }

    return context;
}

// El ancho completo requerido es el ancho del robot más dos márgenes laterales.
// Los cálculos geométricos utilizan la mitad de ese valor como radio.
//
// Una medida desconocida se rechaza; no se interpreta como cero.
export function robotRadius(
    context: SurfaceContext,
): number {
    if (
        context.widthMeters === null
        || context.lateralMarginMeters === null
        || !Number.isFinite(context.widthMeters)
        || !Number.isFinite(context.lateralMarginMeters)
        || context.widthMeters <= 0
        || context.lateralMarginMeters < 0
    ) {
        throw new RoutingError(
            409,
            'Completá el ancho y el margen lateral del modelo del robot para evaluar el paso.',
        );
    }

    return context.widthMeters / 2
        + context.lateralMarginMeters;
}