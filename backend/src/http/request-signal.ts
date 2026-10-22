import type {
  Request,
  Response,
} from 'express';

const signals = new WeakMap<Request, AbortSignal>();

export function attachRequestSignal(
  request: Request,
  response: Response,
  next: () => void,
) {
  const controller = new AbortController();

  signals.set(request, controller.signal);

  const abort = () => controller.abort();

  const close = () => {
    if (!response.writableEnded) {
      abort();
    }

    cleanup();
  };

  const cleanup = () => {
    request.off('aborted', abort);
    response.off('close', close);
    response.off('finish', cleanup);
  };

  request.once('aborted', abort);
  response.once('close', close);
  response.once('finish', cleanup);

  next();
}

export function requestSignal(
  request: Request,
): AbortSignal {
  const signal = signals.get(request);

  if (!signal) {
    throw new Error(
      'Falta el ciclo de cancelación HTTP.',
    );
  }

  return signal;
}
