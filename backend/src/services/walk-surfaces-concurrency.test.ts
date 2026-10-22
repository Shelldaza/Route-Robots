import {
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('./routing', () => ({
  RoutingError: class extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const bounds = {
  south: 38.9,
  north: 38.9001,
  west: -77.04,
  east: -77.0399,
};

it('deduplica la misma zona sin cancelar a otro cliente conectado', async () => {
  let complete!: (response: Response) => void;

  const fetch = vi.fn(
    () => new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );

  vi.stubGlobal('fetch', fetch);

  const { queryWalkSurfaces } =
    await import('./walk-surfaces.js');

  const controller = new AbortController();

  const first = queryWalkSurfaces(
    bounds,
    'current',
    controller.signal,
  );

  const second = queryWalkSurfaces(bounds);

  const failure = expect(first).rejects.toMatchObject({
    name: 'AbortError',
  });

  await Promise.resolve();
  controller.abort();

  complete(Response.json({ features: [] }));

  await failure;

  expect(await second).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
});
