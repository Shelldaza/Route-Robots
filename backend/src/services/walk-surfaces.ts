import { z } from 'zod';
import { RoutingError } from './routing';
import { isArea } from '../../../shared/surfaces';

import type {
    Area,
    Bounds,
    WalkSurface,
} from '../../../shared/surfaces';

export const SURFACE_SOURCES = {
    current:
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/83',
    archive:
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planimetrics_2023/MapServer/11',
} as const;

export type SurfaceSource = keyof typeof SURFACE_SOURCES;

export const SURFACE_SOURCE = SURFACE_SOURCES.current;

export const surfaceBoundsSchema = z.object({
    south: z.coerce.number().finite().min(38.78).max(39.02),
    north: z.coerce.number().finite().min(38.78).max(39.02),
    west: z.coerce.number().finite().min(-77.14).max(-76.89),
    east: z.coerce.number().finite().min(-77.14).max(-76.89),
}).refine(
    (bounds) =>
        bounds.south < bounds.north
        && bounds.west < bounds.east
        && bounds.north - bounds.south <= 0.012
        && bounds.east - bounds.west <= 0.012,
    'Acercá más el mapa para cargar las superficies.',
);

const cache = new Map<
    string,
    { until: number; value: WalkSurface[] }
>();

export async function queryWalkSurfaces(
    bounds: Bounds,
    source: SurfaceSource = 'current',
): Promise<WalkSurface[]> {
    if (!surfaceBoundsSchema.safeParse(bounds).success) {
        throw new RoutingError(
            400,
            'La zona debe estar en Washington y tener suficiente zoom.',
        );
    }

    const cell = 0.0005;

    const snapped = {
        south: Math.floor(bounds.south / cell) * cell,
        west: Math.floor(bounds.west / cell) * cell,
        north: Math.ceil(bounds.north / cell) * cell,
        east: Math.ceil(bounds.east / cell) * cell,
    };

    const key = source + ':' + Object.values(snapped)
        .map((value) => value.toFixed(6))
        .join(':');

    const cached = cache.get(key);

    if (cached && cached.until > Date.now()) {
        return cached.value;
    }

    const params = new URLSearchParams({
        f: 'geojson',
        where:
            "FEATURECODE IN (1480,1481,1482,1483) AND (CAPTUREACTION IS NULL OR CAPTUREACTION <> 'D')",
        geometry:
            `${snapped.west},${snapped.south},${snapped.east},${snapped.north}`,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        inSR: '4326',
        outSR: '4326',
        outFields: 'OBJECTID,FEATURECODE,CAPTUREYEAR',
        returnGeometry: 'true',
        resultRecordCount: '301',
        orderByFields: 'OBJECTID',
    });

    let body: Record<string, unknown>;

    try {
        const response = await fetch(
            `${SURFACE_SOURCES[source]}/query?${params}`,
            { signal: AbortSignal.timeout(15000) },
        );

        if (!response.ok) {
            throw new Error('Respuesta del proveedor no disponible.');
        }

        const text = await response.text();

        if (text.length > 4000000) {
            throw new RoutingError(
                413,
                'La zona tiene demasiada geometría. Acercá el mapa.',
            );
        }

        body = JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
        if (error instanceof RoutingError) throw error;

        throw new RoutingError(
            502,
            'No se pudo consultar la cartografía oficial. Reintentá.',
        );
    }

    if (
        !body
        || typeof body !== 'object'
        || body.error
        || !Array.isArray(body.features)
    ) {
        throw new RoutingError(
            502,
            'La cartografía oficial devolvió una respuesta inválida.',
        );
    }

    const properties = body.properties as
        | Record<string, unknown>
        | undefined;

    if (
        body.features.length > 300
        || body.exceededTransferLimit
        || properties?.exceededTransferLimit
    ) {
        throw new RoutingError(
            413,
            'Hay demasiadas superficies. Acercá el mapa.',
        );
    }

    let count = 0;

    const surfaces = body.features.map(
        (raw: unknown): WalkSurface => {
            if (!raw || typeof raw !== 'object') {
                throw new RoutingError(
                    502,
                    'La cartografía devolvió una superficie inválida.',
                );
            }

            const feature = raw as {
                properties: {
                    OBJECTID: number;
                    FEATURECODE: number;
                    CAPTUREYEAR?: number | null;
                };
                geometry: {
                    type: string;
                    coordinates: unknown;
                };
            };

            const geometry = {
                type: 'MultiPolygon',
                coordinates:
                    feature.geometry?.type === 'Polygon'
                        ? [feature.geometry.coordinates]
                        : feature.geometry?.coordinates,
            };

            if (
                !isArea(geometry)
                || !Number.isSafeInteger(feature.properties?.OBJECTID)
                || ![1480, 1481, 1482, 1483].includes(
                    feature.properties.FEATURECODE,
                )
            ) {
                throw new RoutingError(
                    502,
                    'Hay superficies con formato inválido.',
                );
            }

            for (const point of geometry.coordinates.flat(2)) {
                count++;

                if (
                    Math.abs(point[0]) > 180
                    || Math.abs(point[1]) > 90
                ) {
                    throw new RoutingError(
                        502,
                        'La cartografía no devolvió coordenadas geográficas.',
                    );
                }
            }

            const captured = feature.properties.CAPTUREYEAR;

            return {
                id: feature.properties.OBJECTID,
                code: feature.properties.FEATURECODE,
                capturedAt:
                    typeof captured === 'number'
                    && Number.isFinite(new Date(captured).getTime())
                        ? new Date(captured).toISOString()
                        : null,
                geometry: geometry as Area,
            };
        },
    );

    if (count > 50000) {
        throw new RoutingError(
            413,
            'La zona tiene demasiados vértices. Acercá el mapa.',
        );
    }

    if (cache.size >= 8) {
        cache.delete(cache.keys().next().value!);
    }

    cache.set(key, {
        until: Date.now() + 300000,
        value: surfaces,
    });

    return surfaces;
}