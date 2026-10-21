import {
    createRobotModelSchema,
} from '../schemas/robot-models';

import {
    findRobotModels,
    insertRobotModel,
} from '../repositories/robot-models';

// La ruta transforma este conflicto esperado en HTTP 409.
// El servicio no depende de Express ni conoce la respuesta HTTP.
export class RobotModelConflictError extends Error {
    constructor() {
        super('Ya existe un modelo con ese nombre.');
        this.name = 'RobotModelConflictError';
    }
}

export async function listRobotModels() {
    return findRobotModels();
}

export async function registerRobotModel(value: unknown) {
    // Un llamador distinto de HTTP tampoco puede omitir las validaciones.
    const input = createRobotModelSchema.parse(value);

    try {
        return await insertRobotModel(input);
    } catch (error) {
        // Se conserva el tratamiento anterior de las violaciones de unicidad.
        if (
            error
            && typeof error === 'object'
            && 'code' in error
            && error.code === '23505'
        ) {
            throw new RobotModelConflictError();
        }

        // Se conserva el error inesperado para que la ruta lo registre
        // y devuelva un mensaje general, sin exponer detalles internos.
        throw error;
    }
}