import { describe, expect, it } from 'vitest';
import { isTyping, SHORTCUTS } from './shortcuts';

describe('isTyping', () => {
  it('is true inside inputs, textareas and editable regions', () => {
    const ta = document.createElement('textarea');
    const input = document.createElement('input');
    const div = document.createElement('div');
    div.contentEditable = 'true';
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTyping(ta)).toBe(true);
    expect(isTyping(input)).toBe(true);
    expect(isTyping(div)).toBe(true);
  });

  it('is false on the document body and buttons', () => {
    expect(isTyping(document.body)).toBe(false);
    expect(isTyping(document.createElement('button'))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });

  it('documents every shortcut with a scope', () => {
    expect(SHORTCUTS.length).toBeGreaterThan(8);
    for (const s of SHORTCUTS) expect(s.where).toBeTruthy();
  });
});
