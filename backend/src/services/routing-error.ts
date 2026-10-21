// La misma clase se comparte entre los motores y sus consumidores.
// Conservar una sola definición permite reconocerla con instanceof.
//
// Se mantiene statusCode para conservar el manejo de errores existente
// en los endpoints, las superficies y las herramientas MCP.
export class RoutingError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = 'RoutingError';
    }
}