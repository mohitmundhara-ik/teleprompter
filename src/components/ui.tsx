import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md border text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none';
const variants: Record<Variant, string> = {
  default:
    'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)] hover:border-[var(--ink-3)]',
  primary: 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90',
  ghost: 'border-transparent bg-transparent text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]',
  danger: 'border-[var(--danger)] bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]',
};

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'h-7 px-2' : 'h-8 px-3';
  return (
    <button className={`${base} ${variants[variant]} ${pad} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--ink-2)]">
        <span>{title}</span>
        <span className="flex-1" />
        {right}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="text-[var(--ink-2)]">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-[var(--ink-3)]">{hint}</span> : null}
    </label>
  );
}

export function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-[var(--line)]" aria-hidden />;
}
