export type IncidentEffect =
    | 'informational'
    | 'caution'
    | 'blockage';

type IncidentDefinition = {
    label: string;
    defaultDescription: string;
    defaultDurationMinutes: number;
    defaultEffect: IncidentEffect;
    iconFile: string;
};

export const INCIDENT_CATALOG = {
    temporary_obstacle: {
        label: 'Obstáculo temporal',
        defaultDescription:
            'Se reportó un objeto que obstruye el paso.',
        defaultDurationMinutes: 20,
        defaultEffect: 'blockage',
        iconFile: 'temporary-obstacle.png',
    },
    temporary_closure: {
        label: 'Cierre temporal',
        defaultDescription:
            'Se reportó un cierre temporal del paso.',
        defaultDurationMinutes: 120,
        defaultEffect: 'blockage',
        iconFile: 'temporary-closure.png',
    },
    roadworks: {
        label: 'Obras',
        defaultDescription:
            'Se reportaron obras que impiden circular por este sector.',
        defaultDurationMinutes: 3 * 24 * 60,
        defaultEffect: 'blockage',
        iconFile: 'roadworks.png',
    },
    standing_water: {
        label: 'Acumulación de agua',
        defaultDescription:
            'Se reportó acumulación de agua que impide el paso.',
        defaultDurationMinutes: 180,
        defaultEffect: 'blockage',
        iconFile: 'standing-water.png',
    },
    crowd: {
        label: 'Aglomeración de personas',
        defaultDescription:
            'Se reportó una concentración de personas que impide circular.',
        defaultDurationMinutes: 30,
        defaultEffect: 'blockage',
        iconFile: 'crowd.png',
    },
    obstructing_vehicle: {
        label: 'Vehículo obstruyendo el paso',
        defaultDescription:
            'Se reportó un vehículo que obstruye el paso.',
        defaultDurationMinutes: 15,
        defaultEffect: 'blockage',
        iconFile: 'obstructing-vehicle.png',
    },
    scheduled_event: {
        label: 'Evento programado',
        defaultDescription:
            'Una actividad programada ocupa temporalmente este sector.',
        defaultDurationMinutes: 180,
        defaultEffect: 'blockage',
        iconFile: 'scheduled-event.png',
    },
    pothole: {
        label: 'Bache',
        defaultDescription:
            'Se reportó un bache. Se recomienda circular con precaución.',
        defaultDurationMinutes: 7 * 24 * 60,
        defaultEffect: 'caution',
        iconFile: 'pothole.png',
    },
    uneven_surface: {
        label: 'Superficie irregular',
        defaultDescription:
            'Se reportó una superficie irregular que requiere precaución.',
        defaultDurationMinutes: 7 * 24 * 60,
        defaultEffect: 'caution',
        iconFile: 'uneven-surface.png',
    },
} as const satisfies Record<string, IncidentDefinition>;

export type IncidentType = keyof typeof INCIDENT_CATALOG;

export const INCIDENT_TYPES = Object.keys(
    INCIDENT_CATALOG,
) as IncidentType[];

export function isIncidentType(
    value: unknown,
): value is IncidentType {
    return (
        typeof value === 'string' &&
        Object.prototype.hasOwnProperty.call(
            INCIDENT_CATALOG,
            value,
        )
    );
}