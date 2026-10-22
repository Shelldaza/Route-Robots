// Construye dominio, espacio libre y área de peligro para un radio dado.
import type { Area } from '../../../../shared/contracts/surfaces';
import { offsetArea, booleanArea } from './polygons';


export type SurfaceConstraint = {
    domain: Area;
    free: Area;
    danger: Area;
};


export function makeConstraint(
    surface: Area,
    obstacles: Area,
    radius: number,
): SurfaceConstraint {
    const domain = offsetArea(surface, -radius - 0.02);

    return {
        domain,
        free: booleanArea(
            domain,
            offsetArea(obstacles, radius + 0.02),
            'difference',
        ),
        danger: offsetArea(obstacles, radius + 0.01),
    };
}