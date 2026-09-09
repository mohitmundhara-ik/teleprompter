export function ProgressOverlay({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg)]/85 backdrop-blur-sm">
      <div className="w-[320px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <p className="mb-3 text-[13px]">{label}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-right text-[12px] tabular-nums text-[var(--ink-3)]">{pct}%</p>
      </div>
    </div>
  );
}
