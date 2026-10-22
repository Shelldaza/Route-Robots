// Compara valores JSON al recibirlos.
// No serializa geometrías durante cada render.
export function sameValue(
  a: unknown,
  b: unknown,
): boolean {
  if (Object.is(a, b)) return true;

  if (
    !a
    || !b
    || typeof a !== 'object'
    || typeof b !== 'object'
  ) {
    return false;
  }

  if (Array.isArray(a)) {
    return (
      Array.isArray(b)
      && a.length === b.length
      && a.every(
        (item, index) => sameValue(item, b[index]),
      )
    );
  }

  if (Array.isArray(b)) return false;

  const left = Object.keys(a);
  const right = Object.keys(b);

  return (
    left.length === right.length
    && left.every(
      (key) =>
        Object.hasOwn(b, key)
        && sameValue(
          Reflect.get(a, key),
          Reflect.get(b, key),
        ),
    )
  );
}
