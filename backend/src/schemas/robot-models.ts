import { z } from 'zod';

// Una medida desconocida se representa con null.
// Cero no es un ancho ni un largo válido.
const optionalPositive = z.number()
    .finite()
    .positive()
    .nullish()
    .transform((value) => value ?? null);

// Una pendiente máxima o un margen lateral sí pueden ser cero.
// La transformación conserva ese cero explícito.
const optionalNonnegative = z.number()
    .finite()
    .nonnegative()
    .nullish()
    .transform((value) => value ?? null);

// strictObject rechaza propiedades adicionales.
// Las magnitudes se reciben como números, sin convertir texto automáticamente.
export const createRobotModelSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),

    speedKmh: z.number().finite().positive(),

    batteryCapacityWh: z.number().finite().positive(),

    consumptionWhPerKm: z.number().finite().positive(),

    maxSlopePercent: optionalNonnegative,

    widthMeters: optionalPositive,

    lengthMeters: optionalPositive,

    lateralMarginMeters: optionalNonnegative,

    dataSource: z.enum([
        'simulated',
        'documented',
        'measured',
        'unknown',
    ]),

    sourceNotes: z.string()
        .trim()
        .max(500)
        .nullish()
        .transform((value) => value || null),
}).superRefine((value, context) => {
    // Los datos documentados o medidos necesitan una referencia que permita
    // distinguirlos de una configuración inventada para la simulación.
    if (
        ['documented', 'measured'].includes(value.dataSource)
        && !value.sourceNotes
    ) {
        context.addIssue({
            code: 'custom',
            path: ['sourceNotes'],
            message:
                'Indicá el documento o las condiciones de medición.',
        });
    }
});

// El resultado validado ya tiene el texto normalizado
// y los datos opcionales ausentes convertidos a null.
export type CreateRobotModelInput =
    z.infer<typeof createRobotModelSchema>;