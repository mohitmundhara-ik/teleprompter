import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { Button, Divider } from './ui';
import type { ThemeMode } from '../types';
import type { ZoomMode } from './Canvas';

interface Props {
  onNew(): void;
  onUpload(): void;
  onScreenShare(): void;
  onPrompter(): void;
  onFullscreen(): void;
  onPresent(): void;
  onSettings(): void;
  onSessions(): void;
  sharing: boolean;
  zoom: ZoomMode;
  setZoom(z: ZoomMode): void;
}

export function Toolbar(p: Props) {
  const { index, doc, session, save, step, theme, setTheme, connected } = useStore(useShallow((s) => ({
    index: s.index,
    doc: s.doc,
    session: s.session,
    save: s.save,
    step: s.step,
    theme: s.theme,
    setTheme: s.setTheme,
    connected: s.connected,
  })));
  const count = doc?.pages.length ?? 0;
  const navDisabled = count <= 1;

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
      <span className="mr-1 flex items-center gap-2 text-[13px] font-semibold tracking-tight">
        <span className="h-2 w-2 rounded-full" style={{ background: connected ? 'var(--ok)' : 'var(--line)' }} aria-hidden />
        PromptDeck
      </span>
      <Divider />
      <Button onClick={p.onNew} title="Start a new session">New</Button>
      <Button onClick={p.onUpload} title="Upload a presentation file">Upload</Button>
      <Button onClick={p.onSessions} title="Recent sessions">Sessions</Button>
      <Button onClick={p.onScreenShare} title="Share a screen or window">
        {p.sharing ? 'Stop sharing' : 'Share screen'}
      </Button>
      <Divider />
      <Button onClick={() => step(-1)} disabled={navDisabled} title="Previous (Left arrow)" aria-label="Previous">
        ←
      </Button>
      <span
        className="min-w-[74px] text-center text-[12.5px] tabular-nums text-[var(--ink-2)]"
        data-testid="page-indicator"
      >
        {count ? `${index + 1} / ${count}` : '—'}
      </span>
      <Button onClick={() => step(1)} disabled={navDisabled} title="Next (Right arrow)" aria-label="Next">
        →
      </Button>
      <Divider />
      <select
        value={typeof p.zoom === 'number' ? String(p.zoom) : p.zoom}
        onChange={(e) => {
          const v = e.target.value;
          p.setZoom(v === 'fit' || v === 'width' ? v : Number(v));
        }}
        className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px]"
        aria-label="Zoom"
      >
        <option value="fit">Fit screen</option>
        <option value="width">Fit width</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.5">150%</option>
        <option value="2">200%</option>
      </select>
      <Button onClick={p.onFullscreen} title="Full screen on this monitor (F)">Full screen</Button>
      <Button onClick={p.onPresent} title="Fill this tab with the slide, ready to share (P)">Present</Button>
      <span className="flex-1" />
      <span className="text-[12px] tabular-nums" style={{ color: save === 'error' ? 'var(--danger)' : 'var(--ink-3)' }}>
        {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : save === 'error' ? 'Save failed' : session ? 'Ready' : ''}
      </span>
      <Divider />
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeMode)}
        className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px]"
        aria-label="Theme"
      >
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
      <Button onClick={p.onSettings} aria-label="Settings" title="Settings">
        Settings
      </Button>
      <Button variant="primary" onClick={p.onPrompter} title="Open the teleprompter popout">
        Teleprompter
      </Button>
    </header>
  );
}
