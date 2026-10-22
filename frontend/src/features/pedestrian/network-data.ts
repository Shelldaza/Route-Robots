import {
  ReadCache,
} from '../../../../shared/async/read-cache.ts';

import type {
  Bounds,
} from '../../../../shared/contracts/geography';

import type {
  PedestrianNetwork,
} from '../../../../shared/contracts/pedestrian';

import {
  fetchPedestrianNetwork,
} from './network-api.ts';

const cache = new ReadCache<PedestrianNetwork>(
  12,
  300000,
);

export function loadVisibleNetwork(
  version: string,
  area: Bounds,
  signal: AbortSignal,
) {
  const key = [
    version,
    area.south,
    area.west,
    area.north,
    area.east,
  ].join(':');

  return cache.get(
    key,
    async (sharedSignal) => {
      const value = await fetchPedestrianNetwork(
        AbortSignal.any([
          sharedSignal,
          AbortSignal.timeout(20000),
        ]),
        area,
      );

      if (value.version !== version) {
        throw new Error(
          'La red cambió. Iniciá una entrega nueva.',
        );
      }

      return value;
    },
    signal,
  );
}
