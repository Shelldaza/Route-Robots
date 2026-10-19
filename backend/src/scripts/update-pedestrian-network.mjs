import { writeFile, rename, unlink } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'

// Rectángulo que cubre Washington D. C.
// También incluye un margen de Maryland y Virginia.
const bounds = {
    south: 38.78,
    west: -77.13,
    north: 39.01,
    east: -76.90,
}

// Longitud máxima de cada tramo seleccionable.
const MAX_SEGMENT_METERS = 10

const output = new URL(
    '../data/dc-pedestrian-network.json.gz',
    import.meta.url,
)

const endpoint =
    'https://overpass-api.de/api/interpreter'

const query = `
[out:json][timeout:180];
way["highway"~"^(footway|path|pedestrian)$"](
  ${bounds.south},${bounds.west},${bounds.north},${bounds.east}
);
out geom;
`

function metersBetween(a, b) {
    const rad = Math.PI / 180

    const h =
        Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
        Math.cos(a[1] * rad) *
        Math.cos(b[1] * rad) *
        Math.sin(((b[0] - a[0]) * rad) / 2) ** 2

    return (
        6371000 *
        2 *
        Math.atan2(
            Math.sqrt(h),
            Math.sqrt(Math.max(0, 1 - h)),
        )
    )
}

function splitSegment(segment) {
    const pieces = []
    let current = [segment.coordinates[0]]
    let available = MAX_SEGMENT_METERS

    for (const target of segment.coordinates.slice(1)) {
        let start = current.at(-1)
        let length = metersBetween(start, target)

        if (length < 0.000001) continue

        while (length > available + 0.000001) {
            const fraction = available / length

            const cut = [
                start[0] + (target[0] - start[0]) * fraction,
                start[1] + (target[1] - start[1]) * fraction,
            ]

            current.push(cut)
            pieces.push(current)

            current = [cut]
            available = MAX_SEGMENT_METERS

            start = cut
            length = metersBetween(start, target)
        }

        current.push(target)
        available -= length

        if (available <= 0.000001) {
            pieces.push(current)
            current = [target]
            available = MAX_SEGMENT_METERS
        }
    }

    if (current.length > 1) {
        pieces.push(current)
    }

    return pieces.map((coordinates, index) => ({
        ...segment,
        id: `${segment.id}:part:${index}`,

        // Las piezas consecutivas comparten un nodo.
        // Esto conserva las conexiones del recorrido.
        from:
            index === 0
                ? segment.from
                : `split:${segment.id}:${index}`,

        to:
            index === pieces.length - 1
                ? segment.to
                : `split:${segment.id}:${index + 1}`,

        coordinates,
    }))
}

async function main() {
    console.log(
        'Descargando caminos peatonales de Washington D. C.…',
    )

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent':
                'RouteRobots/1.0 (academic pedestrian network importer; https://github.com/Shelldaza/Route-Robots)',
        },
        body: new URLSearchParams({
            data: query,
        }),
        signal: AbortSignal.timeout(240000),
    })

    if (!response.ok) {
        throw new Error(
            `Overpass respondió HTTP ${response.status}. Reintentá más tarde.`,
        )
    }

    const data = await response.json()

    if (data.remark || !Array.isArray(data.elements)) {
        throw new Error(
            data.remark ||
            'La respuesta de Overpass no es válida.',
        )
    }

    const ways = data.elements.filter((way) => {
        const tags = way.tags ?? {}

        return (
            way.type === 'way' &&
            ['footway', 'path', 'pedestrian'].includes(
                tags.highway,
            ) &&
            !['private', 'no'].includes(tags.access) &&
            !['private', 'no'].includes(tags.foot) &&
            // El motor actual usa caminos bidireccionales.
            !['yes', '1', '-1'].includes(
                tags['oneway:foot'],
            ) &&
            Array.isArray(way.nodes) &&
            Array.isArray(way.geometry) &&
            way.nodes.length === way.geometry.length
        )
    })

    console.log(
        `Vías descargadas: ${ways.length}. Procesando conexiones…`,
    )

    // Cuenta en cuántas vías aparece cada nodo.
    const uses = new Map()

    for (const way of ways) {
        for (const id of new Set(way.nodes)) {
            uses.set(id, (uses.get(id) ?? 0) + 1)
        }
    }

    const inside = ([lng, lat]) =>
        lng >= bounds.west &&
        lng <= bounds.east &&
        lat >= bounds.south &&
        lat <= bounds.north

    const segments = []

    // Primero divide las vías en sus intersecciones reales.
    for (const way of ways) {
        let first = 0

        for (
            let index = 1;
            index < way.nodes.length;
            index += 1
        ) {
            const lastNode =
                index === way.nodes.length - 1

            const sharedNode =
                uses.get(way.nodes[index]) > 1

            if (!lastNode && !sharedNode) continue

            const geometry = way.geometry.slice(
                first,
                index + 1,
            )

            if (
                !geometry.every(
                    (point) =>
                        Number.isFinite(point?.lon) &&
                        Number.isFinite(point?.lat),
                )
            ) {
                throw new Error(
                    `Geometría incompleta en la vía ${way.id}.`,
                )
            }

            const coordinates = geometry.map(
                ({ lon, lat }) => [lon, lat],
            )

            const from = String(way.nodes[first])
            const to = String(way.nodes[index])

            if (
                from !== to &&
                coordinates.every(inside)
            ) {
                const footway = way.tags.footway

                segments.push({
                    id: `osm:${way.id}:${from}:${to}`,
                    wayId: way.id,
                    from,
                    to,
                    kind: ['sidewalk', 'crossing'].includes(
                        footway,
                    )
                        ? footway
                        : 'path',
                    name: way.tags.name ?? '',
                    coordinates,
                })
            }

            first = index
        }
    }

    // Conserva todos los sectores y genera tramos cortos.
    const finalSegments = segments
        .flatMap((segment) => splitSegment(segment))
        .sort((a, b) => a.id.localeCompare(b.id))

    if (finalSegments.length === 0) {
        throw new Error(
            'No se encontraron tramos peatonales.',
        )
    }

    const hash = createHash('sha256')
        .update(JSON.stringify(finalSegments))
        .digest('hex')
        .slice(0, 12)

    const network = {
        version: `dc-footways-${hash}`,
        name: 'Washington D. C. — red peatonal del distrito',
        bounds,
        source: endpoint,
        query,
        retrievedAt: new Date()
            .toISOString()
            .slice(0, 10),
        attribution:
            '© OpenStreetMap contributors — ODbL 1.0',
        segments: finalSegments,
    }

    // Solo reemplaza la captura después de procesarla.
    const rawTemporary = new URL(`${output.href}.raw.tmp`)
    const temporary = new URL(`${output.href}.tmp`)

    await writeFile(
        rawTemporary,
        `${JSON.stringify(network)}\n`,
    )

    await pipeline(
        createReadStream(rawTemporary),
        createGzip({ level: 9 }),
        createWriteStream(temporary),
    )

    await rename(temporary, output)
    await unlink(rawTemporary)

    const counts = {
        sidewalk: 0,
        crossing: 0,
        path: 0,
    }

    for (const segment of finalSegments) {
        counts[segment.kind] += 1
    }

    console.log('Red peatonal actualizada.')
    console.log(`Versión: ${network.version}`)
    console.log(`Total de tramos: ${finalSegments.length}`)
    console.log(`Veredas: ${counts.sidewalk}`)
    console.log(`Cruces: ${counts.crossing}`)
    console.log(`Caminos: ${counts.path}`)
    console.log(
        `Longitud máxima por tramo: ${MAX_SEGMENT_METERS} m`,
    )
}

main().catch((error) => {
    console.error(
        'No se actualizó la red:',
        error.message,
    )
    process.exitCode = 1
})