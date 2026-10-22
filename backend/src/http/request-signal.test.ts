import {
  EventEmitter,
} from 'node:events';

import type {
  Request,
  Response,
} from 'express';

import {
  expect,
  it,
} from 'vitest';

import {
  attachRequestSignal,
  requestSignal,
} from './request-signal';

function setup() {
  const request = new EventEmitter();

  const response = Object.assign(
    new EventEmitter(),
    { writableEnded: false },
  );

  // Dobles de prueba: solo necesitamos eventos y writableEnded.
  const req = request as unknown as Request;
  const res = response as unknown as Response;

  attachRequestSignal(req, res, () => {});

  return {
    request,
    response,
    signal: requestSignal(req),
  };
}

it('cerrar una respuesta incompleta cancela la lectura', () => {
  const { request, response, signal } = setup();

  response.emit('close');

  expect(signal.aborted).toBe(true);
  expect(request.listenerCount('aborted')).toBe(0);
  expect(response.listenerCount('finish')).toBe(0);
});

it('terminar normalmente no cancela un trabajo que ya respondió', () => {
  const { request, response, signal } = setup();

  response.writableEnded = true;
  response.emit('finish');
  response.emit('close');

  expect(signal.aborted).toBe(false);
  expect(request.listenerCount('aborted')).toBe(0);
  expect(response.listenerCount('close')).toBe(0);
});

it('una solicitud interrumpida propaga la cancelación', () => {
  const { request, signal } = setup();

  request.emit('aborted');

  expect(signal.aborted).toBe(true);
});
