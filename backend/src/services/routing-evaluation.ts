import { createHash } from 'node:crypto';

import type {
    RoutingIncident,
    RoutingIncidentInput,
} from '../types/routing-restrictions';

// Esta es la única representación de un incidente que recibe Claude.
// La lista explícita evita enviar geometrías si el registro incorpora
// nuevos campos en el futuro.
export function summarizeRoutingIncident(
    incident: RoutingIncident,
) {
    return {
        id: incident.id,
        type: incident.type,
        effect: incident.effect,
        description: incident.description,
        startsAt: incident.startsAt.toISOString(),
        expiresAt: incident.expiresAt.toISOString(),
    };
}

// La huella permanece en el backend.
//
// Comparar únicamente IDs no alcanza: un incidente puede conservar
// su identificador y cambiar su ubicación, alcance o vigencia.
//
// Por eso incluimos el contenido completo de los bloqueos, también
// las geometrías originales de los incidentes sobre superficies.
export function incidentFingerprint(
    records: RoutingIncidentInput[],
): string {
    const hash = createHash('sha256');

    // Procesamos el contenido por partes para no construir otra
    // cadena gigante que duplique todas las geometrías en memoria.
    //
    // Ordenamos las propiedades para que dos objetos equivalentes
    // produzcan la misma huella aunque sus claves tengan otro orden.
    function visit(value: unknown): void {
        if (value instanceof Date) {
            hash.update(
                JSON.stringify(value.toISOString()),
            );

            return;
        }

        if (Array.isArray(value)) {
            hash.update('[');

            for (const item of value) {
                visit(item);
                hash.update(',');
            }

            hash.update(']');
            return;
        }

        if (
            value !== null
            && typeof value === 'object'
        ) {
            hash.update('{');

            const object =
                value as Record<string, unknown>;

            for (
                const key
                of Object.keys(object).sort()
            ) {
                if (object[key] === undefined) {
                    continue;
                }

                hash.update(JSON.stringify(key));
                hash.update(':');

                visit(object[key]);

                hash.update(',');
            }

            hash.update('}');
            return;
        }

        hash.update(
            JSON.stringify(value) ?? 'null',
        );
    }

    // El orden de lectura de la base no modifica el resultado.
    // Las precauciones no se convierten en restricciones de paso.
    visit(
        records
            .filter((incident) =>
                incident.effect === 'blockage'
            )
            .slice()
            .sort((a, b) =>
                a.id.localeCompare(b.id)
            ),
    );

    return hash.digest('hex');
}