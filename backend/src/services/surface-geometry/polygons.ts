// Operaciones sobre polígonos; no buscan recorridos.
import C from 'clipper-lib';
import { EMPTY } from '../../../../shared/surfaces';
import type { Area } from '../../../../shared/contracts/surfaces';
import { anchor, paths, fromTree } from './clipper';


export function booleanArea(
    a: Area,
    b: Area,
    operation: 'union' | 'intersection' | 'difference',
): Area {
    const origin = a.coordinates.length ? anchor(a) : anchor(b);
    const clipper = new C.Clipper();

    clipper.AddPaths(paths(a, origin), C.PolyType.ptSubject, true);
    clipper.AddPaths(paths(b, origin), C.PolyType.ptClip, true);

    const tree = new C.PolyTree();

    const type =
        operation === 'union'
            ? C.ClipType.ctUnion
            : operation === 'intersection'
                ? C.ClipType.ctIntersection
                : C.ClipType.ctDifference;

    clipper.Execute(
        type,
        tree,
        C.PolyFillType.pftNonZero,
        C.PolyFillType.pftNonZero,
    );

    return fromTree(tree, origin);
}


export function offsetArea(area: Area, meters: number): Area {
    if (!area.coordinates.length) return EMPTY;

    const origin = anchor(area);
    const tree = new C.PolyTree();
    const offset = new C.ClipperOffset(2, 2);

    offset.AddPaths(
        paths(area, origin),
        C.JoinType.jtRound,
        C.EndType.etClosedPolygon,
    );

    offset.Execute(tree, meters * 1000);

    return fromTree(tree, origin);
}


export function squareMeters(area: Area): number {
    return Math.abs(
        paths(area, anchor(area)).reduce(
            (sum, ring) => sum + C.Clipper.Area(ring),
            0,
        ),
    ) / 1000000;
}


export function unionAreas(areas: Area[]): Area {
    return areas.reduce(
        (result, area) => booleanArea(result, area, 'union'),
        EMPTY,
    );
}