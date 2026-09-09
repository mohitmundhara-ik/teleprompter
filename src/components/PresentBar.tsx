import { Button } from './ui';

/**
 * The only chrome drawn over a presenting tab. It stays hidden until the
 * presenter moves the mouse, so a shared tab shows nothing but the slide.
 * Anyone who would rather not risk it at all can drive everything from the
 * teleprompter window, which is never part of the shared tab.
 */
export function PresentBar({
  visible,
  tip,
  onDismissTip,
  index,
  count,
  onPrev,
  onNext,
  onPrompter,
  onExit,
}: {
  visible: boolean;
  tip: boolean;
  onDismissTip(): void;
  index: number;
  count: number;
  onPrev(): void;
  onNext(): void;
  onPrompter(): void;
  onExit(): void;
}) {
  return (
    <>
    {tip && visible ? (
      <div className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]/95 px-3.5 py-2 text-[12.5px] shadow-[var(--shadow)]">
        <span className="max-w-[52ch] leading-snug">
          Share this browser tab in your meeting. Your audience sees the slide only. Drive it from the teleprompter
          window, which is never part of the shared tab.
        </span>
        <button onClick={onDismissTip} className="text-[var(--ink-3)] hover:text-[var(--ink)]">Got it</button>
      </div>
    ) : null}
    <div
      data-testid="present-bar"
      data-no-triple
      className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)]/95 px-3 py-2 shadow-[var(--shadow)] transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      aria-hidden={!visible}
    >
      <Button size="sm" onClick={onPrev} aria-label="Previous" disabled={count <= 1}>←</Button>
      <span className="min-w-[62px] text-center text-[12px] tabular-nums text-[var(--ink-2)]">
        {count ? `${index + 1} / ${count}` : '—'}
      </span>
      <Button size="sm" onClick={onNext} aria-label="Next" disabled={count <= 1}>→</Button>
      <span className="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden />
      <Button size="sm" onClick={onPrompter}>Teleprompter</Button>
      <Button size="sm" variant="ghost" onClick={onExit}>Exit presenting</Button>
    </div>
    </>
  );
}
