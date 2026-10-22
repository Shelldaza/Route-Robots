import { z } from 'zod';

import {
  RoutingError,
} from './routing';

import type {
  Bounds,
  WalkSurface,
} from '../../../shared/contracts/surfaces';

import {
  ReadCache,
} from '../../../shared/async/read-cache';

import {
  fetchWalkSurfaces,
  SURFACE_SOURCES,
} from './dc-gis-provider';

import type {
  SurfaceSource,
} from './dc-gis-provider';

export {
  SURFACE_SOURCES,
} from './dc-gis-provider';

export type {
  SurfaceSource,
} from './dc-gis-provider';

export const SURFACE_SOURCE =
  SURFACE_SOURCES.current;

export const surfaceBoundsSchema = z.object({
    south: z.coerce.number().finite().min(38.78).max(39.02),
    north: z.coerce.number().finite().min(38.78).max(39.02),
    west: z.coerce.number().finite().min(-77.14).max(-76.89),
    east: z.coerce.number().finite().min(-77.14).max(-76.89),
}).refine(
    (bounds) =>
        bounds.south < bounds.north
        && bounds.west < bounds.east
        && bounds.north - bounds.south <= 0.012
        && bounds.east - bounds.west <= 0.012,
    'Acercá más el mapa para cargar las superficies.',
);

// Conserva ocho zonas durante cinco minutos.
const cache = new ReadCache<WalkSurface[]>(
  8,
  300000,
);

export async function queryWalkSurfaces(
  bounds: Bounds,
  source: SurfaceSource = 'current',
  signal?: AbortSignal,
): Promise<WalkSurface[]> {
  signal?.throwIfAborted();

    if (!surfaceBoundsSchema.safeParse(bounds).success) {
        throw new RoutingError(
            400,
            'La zona debe estar en Washington y tener suficiente zoom.',
        );
    }

    const cell = 0.0005;

    const snapped = {
        south: Math.floor(bounds.south / cell) * cell,
        west: Math.floor(bounds.west / cell) * cell,
        north: Math.ceil(bounds.north / cell) * cell,
        east: Math.ceil(bounds.east / cell) * cell,
    };

    const key = source + ':' + Object.values(snapped)
        .map((value) => value.toFixed(6))
        .join(':');



  return cache.get(
    key,
    (sharedSignal) =>
      fetchWalkSurfaces(
        snapped,
        source,
        sharedSignal,
      ),
    signal,
  );
}
