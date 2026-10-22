// Conversión entre GeoJSON y las coordenadas enteras de Clipper.
import C from 'clipper-lib';
import { local, world } from '../../../../shared/surfaces';
import type { Area, Point } from '../../../../shared/contracts/surfaces';


export function anchor(area: Area): Point {
    return area.coordinates[0]?.[0]?.[0] ?? [0, 0];
}


export function paths(area: Area, origin: Point): C.Paths {
    return area.coordinates.flatMap((polygon) =>
        polygon.map((ring, index) => {
            const result = ring.slice(0, -1).map((point) => {
                const projected = local(point, origin);

                return {
                    X: Math.round(projected[0] * 1000),
                    Y: Math.round(projected[1] * 1000),
                };
            });

            if (C.Clipper.Orientation(result) !== (index === 0)) {
                result.reverse();
            }

            return result;
        })
    );
}


export function fromTree(tree: C.PolyTree, origin: Point): Area {
    function ring(path: C.Path): Point[] {
        const result = path.map((point) =>
            world([point.X / 1000, point.Y / 1000], origin)
        );

        return [...result, result[0]!];
    }

    return {
        type: 'MultiPolygon',
        coordinates: C.JS.PolyTreeToExPolygons(tree).map(
            (polygon) => [
                ring(polygon.outer),
                ...polygon.holes.map(ring),
            ],
        ),
    };
}