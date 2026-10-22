// blocked demuestra separación del espacio libre; unknown indica falta de verificación.


export class SurfaceGeometryError extends Error {
    constructor(
        public readonly state: 'blocked' | 'unknown',
        message: string,
    ) {
        super(message);
    }
}