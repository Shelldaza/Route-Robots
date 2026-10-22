import assert from 'node:assert/strict';
import { it } from 'node:test';

import {
  ReadCache,
} from '../../shared/async/read-cache.ts';

import {
  LatestRead,
} from '../../shared/async/latest-read.ts';

import {
  reportBody,
  advanceReport,
} from '../src/features/incidents/report-schedule.ts';

import {
  mergeIncidents,
} from '../src/features/incidents/incident-rules.ts';

import {
  fetchIncidentSnapshot,
} from '../src/features/incidents/incident-api.ts';

const deferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
};

it('dos consumidores comparten una lectura y cancelar uno mantiene al otro', async () => {
  const cache = new ReadCache(2, 10000);
  const gate = deferred();

  let calls = 0;
  let provider;

  const load = (signal) => {
    calls++;
    provider = signal;
    return gate.promise;
  };

  const a = new AbortController();
  const b = new AbortController();

  const first = cache.get('zone', load, a.signal);
  const second = cache.get('zone', load, b.signal);

  const failure = assert.rejects(first, {
    name: 'AbortError',
  });

  await Promise.resolve();
  a.abort();

  assert.equal(provider.aborted, false);

  gate.resolve('ok');

  await failure;

  assert.equal(await second, 'ok');
  assert.equal(calls, 1);

  assert.equal(await cache.get('zone', load), 'ok');
  assert.equal(calls, 1);
});

it('el último consumidor cancela al proveedor; una respuesta tardía no entra en la caché', async () => {
  const cache = new ReadCache(2, 10000);
  const gate = deferred();
  const controller = new AbortController();

  let signal;

  const request = cache.get(
    'zone',
    (value) => {
      signal = value;
      return gate.promise;
    },
    controller.signal,
  );

  const failure = assert.rejects(request, {
    name: 'AbortError',
  });

  await Promise.resolve();
  controller.abort();

  await failure;

  assert.equal(signal.aborted, true);

  gate.resolve('stale');

  await Promise.resolve();

  assert.equal(
    await cache.get('zone', async () => 'fresh'),
    'fresh',
  );
});

it('una consulta fallida puede reintentarse y las zonas no se mezclan', async () => {
  const cache = new ReadCache(2, 10000);

  await assert.rejects(
    cache.get('a', async () => {
      throw new Error('network');
    }),
    /network/,
  );

  assert.equal(
    await cache.get('a', async () => 'a'),
    'a',
  );

  assert.equal(
    await cache.get('b', async () => 'b'),
    'b',
  );
});

it('descarta respuestas antiguas después de reemplazar o cancelar la lectura', () => {
  const reader = new LatestRead();

  const old = reader.start();
  const latest = reader.start();

  assert.equal(old.signal.aborted, true);
  assert.equal(reader.isCurrent(old), false);
  assert.equal(reader.isCurrent(latest), true);

  reader.cancel();

  assert.equal(reader.isCurrent(latest), false);
});

it('reintentar conserva ID de generación, índice, recorrido y fecha del reporte original', () => {
  const context = {
    simulationId: 'sim',
    generationId: 'fixed',
    index: 15,
    networkVersion: 'v1',
    nextAt: 120000,
    coordinates: [
      [-77, 38],
      [-77, 38.001],
    ],
  };

  const body = reportBody(null, context);

  assert.equal(
    reportBody(body, {
      ...context,
      index: 16,
      nextAt: 300000,
      coordinates: [],
    }),
    body,
  );

  assert.equal(
    JSON.parse(body).scenarioTime,
    '1970-01-01T00:02:00.000Z',
  );

  const seen = [];

  assert.equal(
    advanceReport(120000, (at) => {
      seen.push(at);
      return at + 150000;
    }),
    270000,
  );

  assert.deepEqual(seen, [120000]);
});

it('reutiliza referencias idénticas, pero detecta cambios de geometría con el mismo ID', () => {
  const item = {
    id: 'one',
    startsAt: '2026-10-21T12:00:00Z',
    blockedArea: {
      south: 1,
      north: 2,
      west: 1,
      east: 2,
    },
  };

  assert.equal(
    mergeIncidents(
      [item],
      [structuredClone(item)],
    )[0],
    item,
  );

  const changed = {
    ...item,
    blockedArea: {
      ...item.blockedArea,
      north: 3,
    },
  };

  assert.equal(
    mergeIncidents([item], [changed])[0],
    changed,
  );
});

it('la vista de incidentes rechaza un activo sin su geometría', async (t) => {
  const summary = {
    id: 'one',
    simulationId: 'sim',
    type: 'pothole',
    source: 'manual',
    description: 'Bache',
    effect: 'blockage',
    reporterName: 'Usuario',
    placementKind: 'surface',
    createdAt: '2026-10-21T12:00:00Z',
    startsAt: '2026-10-21T12:00:00Z',
    expiresAt: '2026-10-21T13:00:00Z',
  };

  t.mock.method(
    globalThis,
    'fetch',
    async () => Response.json({
      history: [summary],
      active: [],
    }),
  );

  await assert.rejects(
    fetchIncidentSnapshot(
      'sim',
      '2026-10-21T12:05:00Z',
      new AbortController().signal,
    ),
    /Faltan geometrías/,
  );
});
