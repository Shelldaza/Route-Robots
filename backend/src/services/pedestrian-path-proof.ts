import {
    contains,
    cuts,
    interpolate,
    local,
    world,
} from '../../../shared/surfaces';

import type { Area, Point, WalkSurface } from '../../../shared/contracts/surfaces'

import type { PedestrianSegment } from '../../../shared/contracts/pedestrian'

import {
    queryPedestrianSegments,
} from './pedestrian-spatial';

import {
    offsetArea,
    unionAreas,
} from './surface-geometry';

type Edge = {
    key: string;
    from: string;
    to: string;
    a: Point;
    b: Point;
};

type Span = {
    low: number;
    high: number;
    edge: Edge;
};

type State = Edge | 'surface';

type Query = typeof queryPedestrianSegments;

// Tolerancia para reconocer un eje cartográfico.
//
// Estos cinco centímetros absorben diferencias numéricas.
// No representan un ancho supuesto de vereda.
const MATCH_METERS = 0.05;

const EPS = 1e-9;

/**
 * Descompone cada tramo del grafo en sus segmentos geométricos.
 *
 * Los extremos conservan los nodos originales. Los vértices intermedios
 * reciben identificadores exclusivos del tramo al que pertenecen.
 */
function graphEdges(
    segments: PedestrianSegment[],
): Edge[] {
    return segments.flatMap((segment) =>
        segment.coordinates.slice(1).map((b, index) => ({
            key: `${segment.id}:${index}`,

            from:
                index === 0
                    ? segment.from
                    : `${segment.id}:v:${index}`,

            to:
                index + 1 === segment.coordinates.length - 1
                    ? segment.to
                    : `${segment.id}:v:${index + 1}`,

            a: segment.coordinates[index]!,
            b,
        }))
    );
}

/**
 * Encuentra qué parte de a → b coincide con una arista conocida.
 *
 * El resultado utiliza proporciones:
 * 0 es el inicio del segmento solicitado y 1 es su final.
 *
 * Las operaciones geométricas se realizan en metros.
 */
function overlap(
    a: Point,
    b: Point,
    edge: Edge,
): Span | null {
    const delta = local(b, a);
    const c = local(edge.a, a);
    const d = local(edge.b, a);

    const dx = d[0] - c[0];
    const dy = d[1] - c[1];

    const length = Math.hypot(dx, dy);

    if (length < 0.001) {
        return null;
    }

    let low = 0;
    let high = 1;

    // Acota el intervalo permitido para una magnitud que cambia
    // linealmente mientras avanzamos desde a hasta b.
    function clip(
        start: number,
        change: number,
        min: number,
        max: number,
    ) {
        if (Math.abs(change) < 1e-12) {
            return start >= min && start <= max;
        }

        const x = (min - start) / change;
        const y = (max - start) / change;

        low = Math.max(low, Math.min(x, y));
        high = Math.min(high, Math.max(x, y));

        return high >= low;
    }

    const px = -c[0];
    const py = -c[1];

    // Proyección longitudinal: debe permanecer sobre la arista.
    if (!clip(
        (px * dx + py * dy) / length,
        (delta[0] * dx + delta[1] * dy) / length,
        -MATCH_METERS,
        length + MATCH_METERS,
    )) {
        return null;
    }

    // Distancia lateral: debe coincidir con el eje dentro
    // de la tolerancia numérica.
    if (!clip(
        (px * dy - py * dx) / length,
        (delta[0] * dy - delta[1] * dx) / length,
        -MATCH_METERS,
        MATCH_METERS,
    )) {
        return null;
    }

    return high - low > EPS
        ? { low, high, edge }
        : null;
}

function near(
    a: Point,
    b: Point,
) {
    const delta = local(a, b);

    return Math.hypot(
        delta[0],
        delta[1],
    ) <= MATCH_METERS + 0.001;
}

/**
 * Comprueba si podemos pasar de una parte verificada a la siguiente.
 *
 * Fuera de una superficie, dos líneas solo se conectan cuando
 * comparten un nodo del grafo y la transición ocurre junto a ese nodo.
 */
function connects(
    previous: State,
    next: State,
    at: Point,
    domain: Area,
) {
    if (
        previous === 'surface'
        || next === 'surface'
    ) {
        return contains(domain, at);
    }

    if (previous.key === next.key) {
        return true;
    }

    return (
        (
            previous.from === next.from
            && near(at, previous.a)
        )
        || (
            previous.from === next.to
            && near(at, previous.a)
        )
        || (
            previous.to === next.from
            && near(at, previous.b)
        )
        || (
            previous.to === next.to
            && near(at, previous.b)
        )
    );
}

/**
 * Verifica la continuidad cartográfica de un recorrido propuesto.
 *
 * Cada parte debe:
 * - permanecer en una superficie que admite el ancho del robot; o
 * - coincidir con una conexión conocida del grafo peatonal.
 *
 * Aquí todavía no descontamos los obstáculos: esa validación
 * y la adaptación local siguen siendo responsabilidad del núcleo.
 *
 * Si devuelve false, el llamador debe recalcular desde el grafo.
 * No significa que se haya demostrado un bloqueo físico.
 */
export function hasPedestrianPathProof(
    points: readonly Point[],
    surfaces: WalkSurface[],
    radius: number,
    query: Query = queryPedestrianSegments,
): boolean {
    if (points.length < 2) {
        return false;
    }

    // Reducimos la superficie para comprobar por dónde puede
    // circular el centro del robot respetando su radio y margen.
    const domain = offsetArea(
        unionAreas(
            surfaces
                .filter((surface) =>
                    [1480, 1483].includes(surface.code)
                )
                .map((surface) => surface.geometry),
        ),
        -radius - 0.02,
    );

    const began = performance.now();

    // Puede haber varias aristas coincidentes. Conservamos las
    // posibilidades hasta comprobar la conexión siguiente.
    let states: State[] | null = null;

    for (
        let index = 1;
        index < points.length;
        index++
    ) {
        // Si verificar la propuesta tarda demasiado, se abandona
        // este intento y se utiliza el cálculo habitual.
        if (performance.now() - began > 250) {
            return false;
        }

        const a = points[index - 1]!;
        const b = points[index]!;

        const delta = local(b, a);

        if (
            Math.hypot(delta[0], delta[1]) < 0.001
        ) {
            continue;
        }

        const surfaceCuts = cuts(domain, a, b);

        // Revisamos los intervalos completos. No basta con que
        // los extremos estén dentro de una superficie.
        const whollyInside = surfaceCuts
            .slice(1)
            .every((end, i) =>
                contains(
                    domain,
                    interpolate(
                        a,
                        b,
                        (surfaceCuts[i]! + end) / 2,
                    ),
                )
            );

        if (whollyInside) {
            if (
                states
                && !states.some((state) =>
                    connects(
                        state,
                        'surface',
                        a,
                        domain,
                    )
                )
            ) {
                return false;
            }

            states = ['surface'];
            continue;
        }

        // Buscamos solamente los tramos cercanos a esta parte
        // del recorrido, sin recorrer toda la red de Washington.
        const padding = world(
            [MATCH_METERS, MATCH_METERS],
            a,
        );

        const dx = Math.abs(padding[0] - a[0]);
        const dy = Math.abs(padding[1] - a[1]);

        const segments = query(
            {
                west: Math.min(a[0], b[0]) - dx,
                east: Math.max(a[0], b[0]) + dx,
                south: Math.min(a[1], b[1]) - dy,
                north: Math.max(a[1], b[1]) + dy,
            },
            1001,
        );

        if (segments.length > 1000) {
            return false;
        }

        const spans = graphEdges(segments)
            .flatMap((edge) => {
                const span = overlap(a, b, edge);

                return span ? [span] : [];
            });

        // Dividimos la línea donde empieza o termina una
        // superficie o una coincidencia con el grafo.
        const divisions = [
            ...new Set([
                ...surfaceCuts,
                ...spans.flatMap((span) => [
                    span.low,
                    span.high,
                ]),
            ]),
        ].sort((x, y) => x - y);

        for (
            let part = 1;
            part < divisions.length;
            part++
        ) {
            const low = divisions[part - 1]!;
            const high = divisions[part]!;

            if (high - low <= EPS) {
                continue;
            }

            const midpoint = interpolate(
                a,
                b,
                (low + high) / 2,
            );

            const choices: State[] = spans
                .filter((span) =>
                    span.low <= low + EPS
                    && span.high >= high - EPS
                )
                .map((span) => span.edge);

            if (contains(domain, midpoint)) {
                choices.push('surface');
            }

            const at = interpolate(a, b, low);

            const accepted: State[] =
                states === null
                    ? choices
                    : choices.filter((next) =>
                        states!.some((previous) =>
                            connects(
                                previous,
                                next,
                                at,
                                domain,
                            )
                        )
                    );

            if (!accepted.length) {
                return false;
            }

            states = accepted;
        }
    }

    return states !== null;
}