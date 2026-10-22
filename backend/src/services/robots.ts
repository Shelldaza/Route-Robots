import {
    createRobotSchema,
} from '../schemas/robots';

import {
    findRobots,
    insertRobot,
} from '../repositories/robots';

// Distingue situaciones esperables del registro de un fallo interno.
// La ruta HTTP decide cómo convertirlas en una respuesta.
export class RobotRegistrationError extends Error {
    constructor(
        public readonly reason:
            | 'model_not_found'
            | 'duplicate_name',
        message: string,
    ) {
        super(message);
        this.name = 'RobotRegistrationError';
    }
}

export async function listRobots() {
    return findRobots();
}

export async function registerRobot(value: unknown) {
    // También validamos al entrar al servicio, aunque el llamador
    // no sea Express.
    //
    // El esquema es único y se comparte con la validación HTTP.
    const input = createRobotSchema.parse(value);

    let robot: Awaited<ReturnType<typeof insertRobot>>;

    try {
        robot = await insertRobot(input);
    } catch (error) {
        // PostgreSQL identifica una violación de unicidad con SQLSTATE 23505.
        // Conservamos el tratamiento que ya tenía el endpoint.
        if (
            error
            && typeof error === 'object'
            && 'code' in error
            && error.code === '23505'
        ) {
            throw new RobotRegistrationError(
                'duplicate_name',
                'Ya existe un robot con ese nombre o identificador.',
            );
        }

        // Un fallo de conexión u otro error inesperado no debe presentarse
        // como un nombre duplicado ni como un modelo inexistente.
        throw error;
    }

    if (!robot) {
        throw new RobotRegistrationError(
            'model_not_found',
            'El modelo seleccionado no existe.',
        );
    }

    return robot;
}