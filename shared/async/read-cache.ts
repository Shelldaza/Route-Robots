type Pending<T> = {
  controller: AbortController;
  promise: Promise<T>;
  users: number;
};

// Comparte una lectura pendiente entre consumidores de la misma clave.
//
// Cancelar un consumidor no interrumpe a los demás.
// Si todos cancelan, también se cancela la consulta al proveedor.
export class ReadCache<T> {
  private values = new Map<
    string,
    { until: number; value: T }
  >();

  private pending = new Map<string, Pending<T>>();

  private capacity: number;
  private ttlMs: number;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
  }

  async get(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();

    const cached = this.values.get(key);

    if (cached && cached.until > Date.now()) {
      return cached.value;
    }

    this.values.delete(key);

    let task = this.pending.get(key);

    if (!task) {
      const controller = new AbortController();

      const fresh: Pending<T> = {
        controller,
        users: 0,
        promise: Promise.resolve().then(
          () => load(controller.signal),
        ),
      };

      fresh.promise = fresh.promise
        .then((value) => {
          // Una respuesta que llega después de cancelar
          // no puede reponer datos en la caché.
          if (!controller.signal.aborted) {
            for (const [id, item] of this.values) {
              if (item.until <= Date.now()) {
                this.values.delete(id);
              }
            }

            if (this.values.size >= this.capacity) {
              this.values.delete(
                this.values.keys().next().value!,
              );
            }

            this.values.set(key, {
              value,
              until: Date.now() + this.ttlMs,
            });
          }

          return value;
        })
        .finally(() => {
          if (this.pending.get(key) === fresh) {
            this.pending.delete(key);
          }
        });

      this.pending.set(key, fresh);
      task = fresh;
    }

    const active = task;
    active.users++;

    return new Promise<T>((resolve, reject) => {
      let done = false;

      const finish = () => {
        if (done) return false;

        done = true;
        signal?.removeEventListener('abort', abort);
        active.users--;

        return true;
      };

      const abort = () => {
        if (!finish()) return;

        reject(
          signal?.reason
          ?? new DOMException('Cancelado', 'AbortError'),
        );

        if (!active.users) {
          if (this.pending.get(key) === active) {
            this.pending.delete(key);
          }

          active.controller.abort();
        }
      };

      signal?.addEventListener('abort', abort, {
        once: true,
      });

      active.promise.then(
        (value) => {
          if (finish()) resolve(value);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );

      if (signal?.aborted) abort();
    });
  }
}
