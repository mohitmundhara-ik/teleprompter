import { describe, expect, it } from 'vitest';
import { hashFile, noteKey, uid } from './id';

describe('identity helpers', () => {
  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid('s')));
    expect(ids.size).toBe(500);
  });

  it('hashes identical content to the same value', async () => {
    const a = new File(['same bytes'], 'deck.pdf', { type: 'application/pdf' });
    const b = new File(['same bytes'], 'deck.pdf', { type: 'application/pdf' });
    const c = new File(['other bytes'], 'deck.pdf', { type: 'application/pdf' });
    expect(await hashFile(a, a.name)).toBe(await hashFile(b, b.name));
    expect(await hashFile(a, a.name)).not.toBe(await hashFile(c, c.name));
  });

  it('builds a stable note key', () => {
    expect(noteKey('s1', 4)).toBe('s1:4');
  });
});
