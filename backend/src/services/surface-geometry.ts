// Entrada pública: los consumidores conservan sus imports.
export { SurfaceGeometryError } from './surface-geometry/error';
export { booleanArea, offsetArea, squareMeters, unionAreas } from './surface-geometry/polygons';
export { makeConstraint } from './surface-geometry/constraints';
export type { SurfaceConstraint } from './surface-geometry/constraints';
export { adaptLine, connectOnSurface } from './surface-geometry/route';
