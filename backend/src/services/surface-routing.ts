import {
    calculateSurfaceRoute as calculateTrustedSurfaceRoute,
} from './surface-routing-core';

import {
    hasPedestrianPathProof,
} from './pedestrian-path-proof';

import {
    recoverSurfaceRoute,
} from './surface-route-recovery';

import {
    consumeSurfaceRestrictions,
} from './routing-restrictions';

import {
    RoutingError,
} from './routing';

import {
    robotRadius,
} from './surface-incidents';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import type { Point, WalkSurface } from '../../../shared/contracts/surfaces'

// El endpoint conserva este import, pero ahora recibe
// restricciones explícitas.
export {
    toolIncidents,
} from './routing-restrictions';

export {
    legacyObstacles,
    surfaceConstraints,
    previewSurfacePath,
} from './surface-routing-core';

/**
 * Entrada pública del cálculo con superficies.
 *
 * Consume las referencias de superficie, verifica el recorrido
 * propuesto y conserva la recuperación mediante retroceso.
 */
export async function calculateSurfaceRoute(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
    knownSurfaces: WalkSurface[] = [],
    preferredCoordinates?: Point[],
) {
    const request = consumeSurfaceRestrictions(
        value,
        context,
        incidents,
    );

    let verified: Point[] | undefined;

    if (
        preferredCoordinates
        && preferredCoordinates.length >= 2
    ) {
        const surfaces = [
            ...knownSurfaces,
            ...incidents.flatMap((incident) =>
                incident.surfaceImpact?.contextSurfaces
                ?? incident.surfaceImpact?.surfaces
                ?? []
            ),
        ];

        if (
            hasPedestrianPathProof(
                preferredCoordinates,
                surfaces,
                robotRadius(context),
            )
        ) {
            verified = preferredCoordinates;
        }
    }

    try {
        return await calculateTrustedSurfaceRoute(
            request,
            context,
            incidents,
            knownSurfaces,
            verified,
        );
    } catch (error) {
        if (
            !(error instanceof RoutingError)
            || error.statusCode !== 422
        ) {
            throw error;
        }

        const recovered = await recoverSurfaceRoute(
            request,
            context,
            incidents,
            knownSurfaces,
        );

        if (recovered) {
            return recovered;
        }

        throw error;
    }
}