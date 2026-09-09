import type { Envelope, Transport } from '../sync/protocol';

/** Two transports wired to each other, mimicking a BroadcastChannel pair. */
export function transportPair(): [Transport, Transport, { delivered: number }] {
  const stats = { delivered: 0 };
  const cbs: Array<((e: Envelope) => void) | null> = [null, null];
  const make = (self: 0 | 1): Transport => ({
    post(e) {
      stats.delivered++;
      // Real channels deliver to every listener except the sender.
      queueMicrotask(() => cbs[self === 0 ? 1 : 0]?.(e));
    },
    onMessage(cb) {
      cbs[self] = cb;
    },
    close() {
      cbs[self] = null;
    },
  });
  return [make(0), make(1), stats];
}
