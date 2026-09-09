import { uid } from '../lib/id';
import type { Envelope, Payload, Role, Transport } from './protocol';
import { pickTransport } from './transports';

const HEARTBEAT_MS = 1000;
const PEER_TIMEOUT_MS = 3200;

/**
 * Bidirectional channel between the main window and the teleprompter popout.
 * Every frame carries a message id and a source id, so a window never reacts
 * to its own echo and duplicated frames are dropped.
 */
export class Bus {
  readonly windowId = uid('w');
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private handlers = new Set<(p: Payload, e: Envelope) => void>();
  private presenceHandlers = new Set<(connected: boolean) => void>();
  private lastPeerAt = 0;
  private peerConnected = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private sid: string,
    private role: Role,
    private transport: Transport = pickTransport(sid),
  ) {
    this.transport.onMessage((e) => this.receive(e));
    this.post({ t: 'hello', role });
    this.timer = setInterval(() => this.tick(), HEARTBEAT_MS);
  }

  post(payload: Payload) {
    const e: Envelope = { id: uid('m'), src: this.windowId, role: this.role, sid: this.sid, ts: Date.now(), payload };
    this.remember(e.id);
    this.transport.post(e);
  }

  on(handler: (p: Payload, e: Envelope) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onPresence(handler: (connected: boolean) => void) {
    this.presenceHandlers.add(handler);
    handler(this.peerConnected);
    return () => this.presenceHandlers.delete(handler);
  }

  get connected() {
    return this.peerConnected;
  }

  close() {
    this.post({ t: 'bye', role: this.role });
    if (this.timer) clearInterval(this.timer);
    this.transport.close();
    this.handlers.clear();
    this.presenceHandlers.clear();
  }

  private remember(id: string) {
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > 400) {
      const drop = this.seenOrder.shift();
      if (drop) this.seen.delete(drop);
    }
  }

  private receive(e: Envelope) {
    if (!e || e.sid !== this.sid || e.src === this.windowId || this.seen.has(e.id)) return;
    this.remember(e.id);
    if (e.role !== this.role) {
      this.lastPeerAt = Date.now();
      this.setPresence(true);
    }
    if (e.payload.t === 'hello' && e.role !== this.role) {
      // A peer just appeared: announce ourselves so it can pull current state.
      this.post({ t: 'heartbeat', role: this.role });
    }
    if (e.payload.t === 'bye' && e.role !== this.role) this.setPresence(false);
    for (const h of this.handlers) h(e.payload, e);
  }

  private tick() {
    this.post({ t: 'heartbeat', role: this.role });
    if (this.peerConnected && Date.now() - this.lastPeerAt > PEER_TIMEOUT_MS) this.setPresence(false);
  }

  private setPresence(v: boolean) {
    if (this.peerConnected === v) return;
    this.peerConnected = v;
    for (const h of this.presenceHandlers) h(v);
  }
}
