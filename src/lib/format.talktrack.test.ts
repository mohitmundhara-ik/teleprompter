import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasSlideMarkers, matchMarker, parseScriptBlocks, scriptForSlide, splitScriptByMarkers } from './format';

// A real presenter's talk track, labelled the way people label them.
const track = readFileSync(new URL('../test/fixtures/talk-track.txt', import.meta.url), 'utf8');

describe('marker matching', () => {
  it('reads the labels people actually write', () => {
    expect(matchMarker('SLIDE 1 - LOOP ENGINEERING')).toMatchObject({ slide: 0, slideEnd: 0, title: 'LOOP ENGINEERING' });
    expect(matchMarker('SLIDES 5-28 - JEEVENDRA PRESENTS')).toMatchObject({ slide: 4, slideEnd: 27 });
    expect(matchMarker('BEFORE SLIDE 1 - OPENING')).toMatchObject({ slide: 0 });
    expect(matchMarker('AFTER SLIDE 28 - BRIDGE BACK')).toMatchObject({ slide: 27 });
    expect(matchMarker('--- Slide 2 ---')).toMatchObject({ slide: 1, title: '' });
    expect(matchMarker('## Slide 12')).toMatchObject({ slide: 11 });
    expect(matchMarker('[Slide 7]')).toMatchObject({ slide: 6 });
    expect(matchMarker('Slides 5 to 9')).toMatchObject({ slide: 4, slideEnd: 8 });
  });

  it('leaves ordinary sentences and rules alone', () => {
    expect(matchMarker('Move to slide 4 when they answer')).toBeNull();
    expect(matchMarker('============================================')).toBeNull();
    expect(matchMarker('Slide')).toBeNull();
  });
});

describe('the uploaded talk track', () => {
  it('is recognised as a mapped script', () => {
    expect(hasSlideMarkers(track)).toBe(true);
  });

  it('puts each slide body on its own page and nothing else', () => {
    const one = scriptForSlide(parseScriptBlocks(track), 0);
    expect(one).toContain('That is loop engineering');
    expect(one).toContain('Good evening');           // "before slide 1" belongs to page 1
    expect(one).not.toContain('YOUR FLOW');          // preamble never lands on a page
    expect(one).not.toContain('SLIDE 2');
    expect(one).not.toMatch(/={5,}/);                // banner rules stripped

    const twentyNine = scriptForSlide(parseScriptBlocks(track), 28);
    expect(twentyNine.toLowerCase()).toContain('10x');
    expect(twentyNine).not.toContain('loop engineering');
  });

  it('fills every page of a range', () => {
    const map = splitScriptByMarkers(track);
    for (const page of [4, 10, 27]) expect(map.get(page)).toContain('Jeevendra');
    expect(map.get(0)).toBeTruthy();
    expect(map.get(36)).toBeTruthy();
  });

  it('keeps the preamble out of the page map entirely', () => {
    const map = splitScriptByMarkers(track);
    for (const body of map.values()) expect(body).not.toContain('Use this as a speaking guide');
  });
});
