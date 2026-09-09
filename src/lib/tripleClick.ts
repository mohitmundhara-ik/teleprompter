import { useRef } from 'react';

const IGNORE = 'button, a, input, textarea, select, label, video, audio, [data-no-triple]';

/**
 * Triple-click handlers for the presentation stage. Works whether a deck is
 * loaded or the stage is still empty, and stays out of the way of controls and
 * of a presenter who is selecting text.
 */
export function useTripleClick(onFire: () => void) {
  const selectionBefore = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.detail === 1) selectionBefore.current = window.getSelection()?.toString().length ?? 0;
  };

  const onClick = (e: React.MouseEvent) => {
    if (e.detail !== 3) return;
    const el = e.target as HTMLElement;
    if (el.closest(IGNORE)) return;
    // Inside real document text, triple-click is the browser's own
    // select-paragraph gesture and belongs to the presenter.
    if (el.closest('.doc-html, [data-selectable]')) return;
    window.getSelection()?.removeAllRanges();
    onFire();
  };

  return { onMouseDown, onClick };
}
