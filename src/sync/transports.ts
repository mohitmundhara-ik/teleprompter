import type { Envelope, Transport } from './protocol';

const channelName = (sid: string) => `promptdeck:${sid}`;
const storageKey = (sid: string) => `promptdeck.bus.${sid}`;

export function broadcastTransport(sid: string): Transport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const ch = new BroadcastChannel(channelName(sid));
  return {
    post: (e) => ch.postMessage(e),
    onMessage: (cb) => {
      ch.onmessage = (ev) => cb(ev.data as Envelope);
    },
    close: () => ch.close(),
  };
}

/** Fallback for browsers without BroadcastChannel: storage events. */
export function storageTransport(sid: string): Transport {
  const key = storageKey(sid);
  let handler: ((e: Envelope) => void) | null = null;
  const listener = (ev: StorageEvent) => {
    if (ev.key !== key || !ev.newValue || !handler) return;
    try {
      handler(JSON.parse(ev.newValue) as Envelope);
    } catch {
      /* ignore malformed frames */
    }
  };
  window.addEventListener('storage', listener);
  return {
    post: (e) => {
      try {
        localStorage.setItem(key, JSON.stringify(e));
      } catch {
        /* quota: sync degrades, the app still works in one window */
      }
    },
    onMessage: (cb) => {
      handler = cb;
    },
    close: () => window.removeEventListener('storage', listener),
  };
}

export function pickTransport(sid: string): Transport {
  return broadcastTransport(sid) ?? storageTransport(sid);
}
