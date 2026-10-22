import {
  expect,
  it,
  vi,
} from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  pool: { query },
}));

import {
  readIncidentSnapshot,
} from './incident-views';

it('separa resúmenes históricos de los datos activos del mapa', async () => {
  const common = {
    simulationId: 'sim',
    type: 'pothole',
    source: 'manual',
    effect: 'blockage',
    description: 'Bache',
    reporterName: 'Usuario',
    createdAt: '2026-10-21T12:00:00Z',
    startsAt: '2026-10-21T12:00:00Z',
    expiresAt: '2026-10-21T13:00:00Z',
    placementKind: 'surface',
  };

  const geometry = {
    type: 'MultiPolygon',
    coordinates: [],
  };

  query.mockResolvedValue({
    rows: [
      {
        ...common,
        id: 'active',
        active: true,
        blockedArea: {},
        surfaceImpact: {
          representation: 'map',
          geometry,
          collisionGeometry: geometry,
        },
      },
      {
        ...common,
        id: 'finished',
        active: false,
        blockedArea: {},
        surfaceImpact: null,
      },
    ],
  });

  const result = await readIncidentSnapshot(
    'sim',
    '2026-10-21T12:05:00Z',
  );

  expect(result.history).toHaveLength(2);

  expect(
    result.active.map((item) => item.id),
  ).toEqual(['active']);

  for (const item of result.history) {
    expect(item).not.toHaveProperty('surfaceImpact');
    expect(item).not.toHaveProperty('pedestrianImpact');
    expect(item).not.toHaveProperty('blockedArea');
  }

  expect(result.active[0]).not.toHaveProperty('active');

  expect(query.mock.calls[0]![1]).toEqual([
    'sim',
    '2026-10-21T12:05:00Z',
  ]);

  expect(query.mock.calls[0]![0]).toContain(
    "s.impact->'collisionGeometry'",
  );

  expect(query.mock.calls[0]![0]).not.toContain(
    "s.impact->'contextSurfaces'",
  );
});
