import {
  createHash,
} from 'node:crypto';

// Mantiene el generador reproducible y los IDs de reintento.
export function random(seed: string) {
    let state = createHash('sha256')
        .update(seed)
        .digest()
        .readUInt32LE(0);

    return () => {
        state += 0x6D2B79F5;

        let value = Math.imul(
            state ^ (state >>> 15),
            1 | state,
        );

        value ^= value + Math.imul(
            value ^ (value >>> 7),
            61 | value,
        );

        return (
            (value ^ (value >>> 14)) >>> 0
        ) / 4294967296;
    };
}

// Conserva exactamente 15 posiciones por bloque de 100.
export function isRouteReport(
    seed: string,
    index: number,
): boolean {
    const draw = random(
        `${seed}:batch:${Math.floor(index / 100)}`,
    );

    const slots = Array.from(
        { length: 100 },
        (_, i) => i < 15,
    );

    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(draw() * (i + 1));

        [slots[i], slots[j]] = [
            slots[j]!,
            slots[i]!,
        ];
    }

    return slots[index % 100]!;
}

export function randomIncidentId(
    simulationId: string,
    generationId: string,
    index: number,
) {
    const hash = createHash('sha256')
        .update(
            `fleet:${simulationId}:${generationId}:${index}`,
        )
        .digest('hex');

    return (
        `${hash.slice(0, 8)}-`
        + `${hash.slice(8, 12)}-`
        + `4${hash.slice(13, 16)}-`
        + `a${hash.slice(17, 20)}-`
        + hash.slice(20, 32)
    );
}
