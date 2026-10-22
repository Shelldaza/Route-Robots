import {
  RoutingError,
} from './routing';

import {
  isArea,
} from '../../../shared/surfaces';

import type {
  Area,
  Bounds,
  WalkSurface,
} from '../../../shared/contracts/surfaces';

export const SURFACE_SOURCES = {
    current:
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/83',
    archive:
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planimetrics_2023/MapServer/11',
} as const;

export type SurfaceSource =
  keyof typeof SURFACE_SOURCES;

// Este módulo interpreta exclusivamente la respuesta de DC GIS.
// No administra caché ni conoce los consumidores conectados.
export async function fetchWalkSurfaces(
  snapped: Bounds,
  source: SurfaceSource,
  signal: AbortSignal,
): Promise<WalkSurface[]> {
  signal.throwIfAborted();

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
            { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) },
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
        signal.throwIfAborted();
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



  signal.throwIfAborted();

  return surfaces;
}
