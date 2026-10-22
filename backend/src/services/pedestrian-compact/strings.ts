// Codificación y acceso puntual a las columnas de texto.
import type { Strings } from './model';


export function encode(values: string[]): Strings {
    const offsets = new Uint32Array(values.length + 1);
    let size = 0;

    values.forEach((value, index) => {
        offsets[index] = size;
        size += Buffer.byteLength(value);
    });

    offsets[values.length] = size;

    const bytes = Buffer.allocUnsafe(size);

    values.forEach((value, index) => {
        bytes.write(value, offsets[index]!);
    });

    return { bytes, offsets };
}


export function stringAt(
    strings: Strings,
    index: number,
): string {
    const start = strings.offsets[index]!;

    return Buffer.from(
        strings.bytes.buffer,
        strings.bytes.byteOffset + start,
        strings.offsets[index + 1]! - start,
    ).toString('utf8');
}