import { describe, expect, it, vi } from 'vitest';
import { Bus } from './bus';
import { transportPair } from '../test/memoryTransport';
import type { Payload } from './protocol';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Bus', () => {
  it('delivers a payload from the main window to the prompter', async () => {
    const [a, b] = transportPair();
    const main = new Bus('s1', 'main', a);
    const prompter = new Bus('s1', 'prompter', b);
    const seen: Payload[] = [];
    prompter.on((p) => seen.push(p));

    main.post({ t: 'nav', index: 4 });
    await flush();

    expect(seen.some((p) => p.t === 'nav' && p.index === 4)).toBe(true);
    main.close();
    prompter.close();
  });

  it('never reacts to its own messages', async () => {
    const [a, b] = transportPair();
    const main = new Bus('s2', 'main', a);
    new Bus('s2', 'prompter', b);
    const handler = vi.fn();
    main.on(handler);

    main.post({ t: 'nav', index: 2 });
    await flush();

    expect(handler.mock.calls.every(([p]) => p.t !== 'nav')).toBe(true);
    main.close();
  });

  it('drops duplicate frames', async () => {
    const [a, b] = transportPair();
    const main = new Bus('s3', 'main', a);
    const prompter = new Bus('s3', 'prompter', b);
    const navs: number[] = [];
    prompter.on((p) => p.t === 'nav' && navs.push(p.index));

    main.post({ t: 'nav', index: 1 });
    await flush();
    // Replay the exact frame a transport might duplicate.
    const replay = { id: 'fixed', src: 'other', role: 'main' as const, sid: 's3', ts: Date.now(), payload: { t: 'nav' as const, index: 7 } };
    a.post(replay);
    a.post(replay);
    await flush();

    expect(navs).toEqual([1, 7]);
    main.close();
    prompter.close();
  });

  it('ignores frames from a different session', async () => {
    const [a, b] = transportPair();
    const main = new Bus('sA', 'main', a);
    const other = new Bus('sB', 'prompter', b);
    const handler = vi.fn();
    other.on(handler);

    main.post({ t: 'nav', index: 3 });
    await flush();

    expect(handler).not.toHaveBeenCalled();
    main.close();
    other.close();
  });

  it('reports presence once a peer speaks', async () => {
    const [a, b] = transportPair();
    const main = new Bus('s4', 'main', a);
    const states: boolean[] = [];
    main.onPresence((c) => states.push(c));
    expect(states[0]).toBe(false);

    const prompter = new Bus('s4', 'prompter', b);
    await flush();

    expect(main.connected).toBe(true);
    main.close();
    prompter.close();
  });
});
