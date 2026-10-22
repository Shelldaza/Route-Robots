import type { Coordinate as Point } from '../../../../shared/contracts/geography';
import type { CompactNetwork } from './model';


export function distanceMeters(
    a: Point,
    b: Point,
): number {
    const rad = Math.PI / 180;

    const h =
        Math.sin((b[1] - a[1]) * rad / 2) ** 2
        + Math.cos(a[1] * rad)
        * Math.cos(b[1] * rad)
        * Math.sin((b[0] - a[0]) * rad / 2) ** 2;

    return 12742000 * Math.atan2(
        Math.sqrt(h),
        Math.sqrt(Math.max(0, 1 - h)),
    );
}


export function pointAt(
    net: CompactNetwork,
    node: number,
): Point {
    return [
        net.xy[node * 2]!,
        net.xy[node * 2 + 1]!,
    ];
}