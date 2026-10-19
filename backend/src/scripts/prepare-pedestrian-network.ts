import {
    createReadStream,
    createWriteStream,
    readFileSync,
    writeFileSync,
    renameSync,
    unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import {
    createGunzip,
    gunzipSync,
    gzipSync,
} from 'node:zlib';
import {
    pipeline,
} from 'node:stream/promises';

import {
    compileNetwork,
    encodeCompactNetwork,
} from '../services/pedestrian-compact';

import type {
    PedestrianNetwork,
} from '../services/pedestrian-network';

async function main() {
    const file = join(
        __dirname,
        '../data/dc-pedestrian-network.bin',
    );

    const compressed = `${file}.gz`;

    if (!process.argv.includes('--unpack')) {
        const network = JSON.parse(
            gunzipSync(
                readFileSync(
                    join(
                        __dirname,
                        '../data/dc-pedestrian-network.json.gz',
                    ),
                ),
            ).toString('utf8'),
        ) as PedestrianNetwork;

        const compact = compileNetwork(network);
        const bytes = encodeCompactNetwork(compact);

        writeFileSync(
            `${compressed}.tmp`,
            gzipSync(bytes, { level: 9 }),
        );

        renameSync(
            `${compressed}.tmp`,
            compressed,
        );

        console.log(
            `Red preparada: ${network.version}; `
            + `${compact.ways.length} tramos; `
            + `${(bytes.length / 1048576).toFixed(1)} MiB sin comprimir.`,
        );
    }

    try {
        await pipeline(
            createReadStream(compressed),
            createGunzip(),
            createWriteStream(`${file}.tmp`),
        );

        renameSync(`${file}.tmp`, file);

        console.log('Captura binaria lista.');
    } catch (error) {
        try {
            unlinkSync(`${file}.tmp`);
        } catch {
            // No quedó un archivo temporal.
        }

        throw error;
    }
}

main().catch((error: unknown) => {
    console.error(
        error instanceof Error
            ? error.message
            : 'No se pudo preparar la red.',
    );

    process.exitCode = 1;
});