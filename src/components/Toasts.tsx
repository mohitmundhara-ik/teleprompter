import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';

export function Toasts() {
  const { toasts, dismissToast } = useStore(useShallow((s) => ({ toasts: s.toasts, dismissToast: s.dismissToast })));
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(560px,90vw)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] shadow-[var(--shadow)]"
          style={{
            borderColor: t.tone === 'error' ? 'var(--danger)' : t.tone === 'warn' ? 'var(--warn)' : 'var(--line)',
          }}
        >
          <span className="flex-1 leading-snug">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="text-[var(--ink-3)] hover:text-[var(--ink)]" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
