import { describe, expect, it } from 'vitest';
import { bytes, hasSlideMarkers, parseScriptBlocks, splitScriptByMarkers, timeAgo } from './format';

describe('splitScriptByMarkers', () => {
  it('splits on --- Slide N --- markers', () => {
    const map = splitScriptByMarkers('opening line\n--- Slide 2 ---\nsecond page\n--- Slide 3 ---\nthird page');
    expect(map.get(0)).toBe('opening line');
    expect(map.get(1)).toBe('second page');
    expect(map.get(2)).toBe('third page');
  });

  it('accepts markdown and bracket forms', () => {
    const map = splitScriptByMarkers('## Slide 1\nalpha\n[Slide 2]\nbeta\n**Page 3**\ngamma');
    expect(map.get(0)).toBe('alpha');
    expect(map.get(1)).toBe('beta');
    expect(map.get(2)).toBe('gamma');
  });

  it('returns a single block when no markers exist', () => {
    const map = splitScriptByMarkers('just one paragraph\nand another');
    expect(map.size).toBe(1);
    expect(map.get(0)).toContain('another');
  });

  it('keeps blank sections out of the map', () => {
    const map = splitScriptByMarkers('--- Slide 1 ---\n\n--- Slide 2 ---\nreal text');
    expect(map.has(0)).toBe(false);
    expect(map.get(1)).toBe('real text');
  });
});

describe('formatting helpers', () => {
  it('formats byte sizes', () => {
    expect(bytes(900)).toBe('900 B');
    expect(bytes(2048)).toBe('2 KB');
    expect(bytes(5 * 1024 ** 2)).toBe('5.0 MB');
  });

  it('formats relative times', () => {
    const now = Date.now();
    expect(timeAgo(now - 5_000, now)).toBe('just now');
    expect(timeAgo(now - 120_000, now)).toBe('2 min ago');
    expect(timeAgo(now - 3 * 3600_000, now)).toBe('3 hr ago');
    expect(timeAgo(now - 25 * 3600_000, now)).toBe('yesterday');
  });
});

describe('parseScriptBlocks', () => {
  it('keeps the slide number with each block', () => {
    const blocks = parseScriptBlocks('intro\n--- Slide 2 ---\nsecond\n--- Slide 5 ---\nfifth');
    expect(blocks.map((b) => b.slide)).toEqual([null, 1, 4]);
    expect(blocks[1].text).toBe('second');
    expect(blocks[2].text).toBe('fifth');
  });

  it('reports whether a script carries markers at all', () => {
    expect(hasSlideMarkers('plain talk track with no markers')).toBe(false);
    expect(hasSlideMarkers('opening\n## Slide 3\nlater')).toBe(true);
  });

  it('keeps an empty section so its slide still resolves', () => {
    const blocks = parseScriptBlocks('--- Slide 1 ---\n\n--- Slide 2 ---\nreal');
    expect(blocks.find((b) => b.slide === 0)?.text).toBe('');
    expect(blocks.find((b) => b.slide === 1)?.text).toBe('real');
  });
});
