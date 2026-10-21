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
    RoutingError,
} from './routing';

import {
    robotRadius,
} from './surface-incidents';

import type {
    SurfaceContext,
    SurfaceIncident,
} from '../types/surfaces';

import type {
    Point,
    WalkSurface,
} from '../../../shared/surfaces';

// Conservamos las exportaciones utilizadas por el resto del proyecto.
export {
    legacyObstacles,
    surfaceConstraints,
    previewSurfacePath,
    toolIncidents,
} from './surface-routing-core';

/**
 * Entrada pública del cálculo con superficies.
 *
 * Primero verifica el recorrido propuesto por el navegador.
 * Después intenta la adaptación local y el cálculo habitual.
 *
 * Si esos intentos no encuentran una ruta, prueba reconectar los
 * extremos utilizando las partes libres de los tramos del servidor.
 */
export async function calculateSurfaceRoute(
    value: unknown,
    context: SurfaceContext,
    incidents: SurfaceIncident[],
    knownSurfaces: WalkSurface[] = [],
    preferredCoordinates?: Point[],
) {
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
            value,
            context,
            incidents,
            knownSurfaces,
            verified,
        );
    } catch (error) {
        // Los errores de configuración, versión de red o proveedor
        // deben conservarse. La recuperación solo intenta resolver
        // un cálculo que terminó sin una ruta válida.
        if (
            !(error instanceof RoutingError)
            || error.statusCode !== 422
        ) {
            throw error;
        }

        const recovered = await recoverSurfaceRoute(
            value,
            context,
            incidents,
            knownSurfaces,
        );

        if (recovered) {
            return recovered;
        }

        // Si tampoco hay una reconexión verificable, mantenemos
        // el error original y no aplicamos un recorrido inventado.
        throw error;
    }
}