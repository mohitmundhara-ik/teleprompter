import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { PALETTES } from '../lib/prefs';
import { useAutoScroll } from './useAutoScroll';
import { isTyping } from '../lib/shortcuts';
import { blockCoversSlide, parseScriptBlocks, scriptForSlide } from '../lib/format';
import { Toasts } from '../components/Toasts';

export default function Prompter({ sessionId }: { sessionId: string }) {
  const s = useStore();
  const { init, display, setDisplay, step, index, notes, script, meta, connected, peerEverSeen, setNote, setScript, sendMedia } = s;
  const [editing, setEditing] = useState(false);
  const [narrow, setNarrow] = useState(window.innerWidth < 420);
  const boot = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (boot.current) return;
    boot.current = true;
    void init('prompter', sessionId);
    return () => useStore.getState().teardown();
  }, [init, sessionId]);

  useEffect(() => {
    // Named so it is obvious which window not to pick when sharing a screen.
    document.title = 'Teleprompter (private) — PromptDeck';
  }, []);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 420);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Slide markers such as "--- Slide 4 ---" are detected in the script, so one
  // pasted talk track lines itself up with the deck without being split first.
  const blocks = useMemo(() => parseScriptBlocks(script), [script]);
  const marked = useMemo(() => blocks.some((b) => b.slide !== null), [blocks]);
  const blockForSlide = useMemo(() => scriptForSlide(blocks, index), [blocks, index]);
  // In notes mode a page with no notes of its own falls back to its marked
  // section of the script rather than showing nothing.
  const text = display.source === 'script' ? script : (notes[index] || blockForSlide || '');
  const following = display.source === 'script' && marked && display.followSlides;
  const { ref: scrollRef, running, setRunning, restart } = useAutoScroll(display.scrollSpeed);

  useEffect(() => {
    setRunning(false);
    if (!following) {
      restart();
      return;
    }
    // Jump the script to the section that belongs to the current slide.
    const el =
      scrollRef.current?.querySelector<HTMLElement>(`[data-slide="${index}"]`) ??
      [...(scrollRef.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])].find((n) => {
        const start = Number(n.dataset.slide);
        const end = Number(n.dataset.slideEnd ?? n.dataset.slide);
        return index >= start && index <= end;
      });
    if (el && scrollRef.current) scrollRef.current.scrollTop = Math.max(0, el.offsetTop - 12);
    else restart();
  }, [index, display.source, following, script]); // eslint-disable-line react-hooks/exhaustive-deps

  const palette = PALETTES[display.palette];
  const pageCount = meta.pageCount;
  const slideTitle = meta.pageTitles[index] ?? '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault(); step(1); break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault(); step(-1); break;
        case ' ':
          e.preventDefault(); setRunning(!running); break;
        case 'ArrowDown':
          e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollTop += 60; break;
        case 'ArrowUp':
          e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollTop -= 60; break;
        case '+': case '=':
          setDisplay({ fontSize: Math.min(160, display.fontSize + 2) }); break;
        case '-':
          setDisplay({ fontSize: Math.max(10, display.fontSize - 2) }); break;
        case 'd': case 'D':
          setDisplay({ palette: display.palette === 'dark' ? 'light' : 'dark' }); break;
        case 'm': case 'M':
          setDisplay({ mirrorX: !display.mirrorX }); break;
        case 'h': case 'H':
          setDisplay({ controlsHidden: !display.controlsHidden }); break;
        case 'r': case 'R':
          restart(); break;
        case 'f': case 'F':
          void document.documentElement.requestFullscreen?.().catch(() => undefined); break;
        case 'Escape':
          if (document.fullscreenElement) void document.exitFullscreen();
          else if (display.controlsHidden) setDisplay({ controlsHidden: false });
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [display, running, step, setDisplay, restart, setRunning, scrollRef]);

  const transform = useMemo(
    () => `scaleX(${display.mirrorX ? -1 : 1}) scaleY(${display.mirrorY ? -1 : 1})`,
    [display.mirrorX, display.mirrorY],
  );

  const status = connected ? 'Connected' : peerEverSeen ? 'Main presentation disconnected' : 'Waiting for the main window';

  return (
    <div className="flex h-full flex-col" style={{ background: palette.bg, color: palette.fg }}>
      <header className="flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: 'rgb(128 128 128 / 0.3)' }}>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: connected ? '#3ecf8e' : peerEverSeen ? '#ff5f56' : '#f0b429' }}
          aria-hidden
        />
        <span className="truncate opacity-80" title={meta.title}>{meta.title}</span>
        <span className="flex-1" />
        <span className="whitespace-nowrap opacity-60" data-testid="conn-status">{status}</span>
        <span className="whitespace-nowrap opacity-60">{s.save === 'saving' ? 'Saving…' : s.save === 'error' ? 'Save failed' : 'Saved'}</span>
      </header>

      {!display.controlsHidden ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: 'rgb(128 128 128 / 0.3)' }}>
          <Tool onClick={() => setDisplay({ source: display.source === 'notes' ? 'script' : 'notes' })}>
            {display.source === 'notes' ? 'Slide notes' : 'Full script'}
          </Tool>
          <Tool onClick={() => setEditing(!editing)} active={editing}>{editing ? 'Done' : 'Edit'}</Tool>
          <Tool onClick={() => setRunning(!running)} active={running}>{running ? 'Pause' : 'Scroll'}</Tool>
          <Tool onClick={restart}>Top</Tool>
          {marked ? (
            <Tool
              onClick={() => setDisplay({ followSlides: !display.followSlides })}
              active={display.followSlides}
              title="Keep the script on the current slide"
            >
              Follow
            </Tool>
          ) : null}
          <input
            type="range" min={2} max={200} value={display.scrollSpeed}
            onChange={(e) => setDisplay({ scrollSpeed: Number(e.target.value) })}
            className="w-16" aria-label="Scroll speed" title="Scroll speed"
          />
          <span className="w-12 text-[11px] tabular-nums opacity-70">{display.scrollSpeed} px/s</span>
          <Tool onClick={() => setDisplay({ fontSize: Math.max(10, display.fontSize - 2) })} label="Smaller text">A−</Tool>
          <span className="w-8 text-center text-[11px] tabular-nums opacity-70">{display.fontSize}</span>
          <Tool onClick={() => setDisplay({ fontSize: Math.min(160, display.fontSize + 2) })} label="Bigger text">A+</Tool>
          {!narrow ? (
            <>
              <Tool onClick={() => setDisplay({ lineHeight: Math.max(1, +(display.lineHeight - 0.1).toFixed(2)) })}>↕−</Tool>
              <span className="w-8 text-center text-[11px] tabular-nums opacity-70">{display.lineHeight.toFixed(1)}</span>
              <Tool onClick={() => setDisplay({ lineHeight: Math.min(3, +(display.lineHeight + 0.1).toFixed(2)) })}>↕+</Tool>
              <Tool onClick={() => setDisplay({ columnWidth: Math.max(30, display.columnWidth - 6) })}>◧−</Tool>
              <Tool onClick={() => setDisplay({ columnWidth: Math.min(100, display.columnWidth + 6) })}>◧+</Tool>
              <select
                value={display.align}
                onChange={(e) => setDisplay({ align: e.target.value as 'left' | 'center' | 'right' })}
                className="h-6 rounded border bg-transparent px-1 text-[11.5px]"
                style={{ borderColor: 'rgb(128 128 128 / 0.4)', color: 'inherit' }}
                aria-label="Text alignment"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <select
                value={display.palette}
                onChange={(e) => setDisplay({ palette: e.target.value as typeof display.palette })}
                className="h-6 rounded border bg-transparent px-1 text-[11.5px]"
                style={{ borderColor: 'rgb(128 128 128 / 0.4)', color: 'inherit' }}
                aria-label="Colour scheme"
              >
                {Object.entries(PALETTES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <Tool onClick={() => setDisplay({ mirrorX: !display.mirrorX })} active={display.mirrorX}>Mirror ↔</Tool>
              <Tool onClick={() => setDisplay({ mirrorY: !display.mirrorY })} active={display.mirrorY}>Mirror ↕</Tool>
              <Tool onClick={() => setDisplay({ guideOffset: display.guideOffset ? 0 : 38 })} active={display.guideOffset > 0}>Guide</Tool>
              <Tool onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>Full</Tool>
              <Tool onClick={() => setDisplay({ fontSize: 30, lineHeight: 1.55, columnWidth: 92, align: 'left', mirrorX: false, mirrorY: false, guideOffset: 0, scrollSpeed: 40 })}>Reset</Tool>
            </>
          ) : null}
          <Tool onClick={() => setDisplay({ controlsHidden: true })} label="Hide controls">Hide</Tool>
        </div>
      ) : null}

      {meta.kind === 'video' || meta.kind === 'audio' ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: 'rgb(128 128 128 / 0.3)' }} data-testid="media-controls">
          <Tool onClick={() => sendMedia('play')} label="Play">▶ Play</Tool>
          <Tool onClick={() => sendMedia('pause')} label="Pause">❚❚ Pause</Tool>
          <Tool onClick={() => sendMedia('seek', -10)} label="Back ten seconds">−10s</Tool>
          <Tool onClick={() => sendMedia('seek', 10)} label="Forward ten seconds">+10s</Tool>
          <select
            defaultValue="1"
            onChange={(e) => sendMedia('rate', Number(e.target.value))}
            className="h-6 rounded border bg-transparent px-1 text-[11.5px]"
            style={{ borderColor: 'rgb(128 128 128 / 0.4)', color: 'inherit' }}
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>{r}x</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {display.guideOffset > 0 ? (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 border-y"
            style={{ top: `${display.guideOffset}%`, height: '2.4em', borderColor: 'rgb(128 128 128 / 0.45)', background: 'rgb(128 128 128 / 0.10)' }}
            aria-hidden
          />
        ) : null}

        {editing ? (
          <textarea
            ref={editorRef}
            data-testid="prompter-editor"
            value={text}
            spellCheck={false}
            onChange={(e) => (display.source === 'script' ? setScript(e.target.value) : setNote(index, e.target.value))}
            className="h-full w-full resize-none bg-transparent p-4 text-[15px] leading-relaxed outline-none"
            style={{ color: palette.fg }}
            placeholder="Type the words for this page."
          />
        ) : (
          <div ref={scrollRef} className="pd-scroll h-full overflow-auto px-4 py-5" data-testid="prompter-text">
            <div
              className="reader-text mx-auto"
              style={{
                width: `${display.columnWidth}%`,
                fontSize: `${display.fontSize}px`,
                lineHeight: display.lineHeight,
                textAlign: display.align,
                transform,
              }}
            >
              {display.source === 'script' && marked
                ? blocks.map((b, i) => (
                    <div
                      key={i}
                      data-slide={b.slide ?? undefined}
                      data-slide-end={b.slideEnd ?? undefined}
                      style={{
                        opacity: !following || b.slide === null || blockCoversSlide(b, index) ? 1 : 0.42,
                        paddingBottom: '0.7em',
                      }}
                    >
                      {b.slide !== null ? (
                        <div style={{ fontSize: '0.42em', opacity: 0.7, paddingBottom: '0.2em' }}>
                          {b.slideEnd !== null && b.slideEnd !== b.slide
                            ? `Slides ${b.slide + 1}-${b.slideEnd + 1}`
                            : `Slide ${b.slide + 1}`}
                          {b.title ? ` · ${b.title}` : ''}
                        </div>
                      ) : null}
                      {b.text}
                    </div>
                  ))
                : text || 'No script for this page yet. Press Edit and type what you want to say.'}
            </div>
            <div style={{ height: '55vh' }} aria-hidden />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t px-2 py-1.5" style={{ borderColor: 'rgb(128 128 128 / 0.3)' }}>
        <NavButton onClick={() => step(-1)} label="Previous page" testid="prompter-prev">◀ Prev</NavButton>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="text-[12px] tabular-nums opacity-80" data-testid="prompter-count">
            {pageCount ? `${index + 1} / ${pageCount}` : '—'}
          </span>
          {!narrow ? (
            <span className="max-w-full truncate text-[11px] opacity-55">
              {display.source === 'notes' && !notes[index] && blockForSlide ? 'from the script' : slideTitle}
            </span>
          ) : null}
        </div>
        <NavButton onClick={() => step(1)} label="Next page" testid="prompter-next">Next ▶</NavButton>
      </footer>
      <Toasts />
    </div>
  );
}

function Tool({
  children,
  onClick,
  active,
  label,
  title,
}: {
  children: React.ReactNode;
  onClick(): void;
  active?: boolean;
  /** Only for icon-style buttons whose text is not a readable name. */
  label?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className="h-6 rounded border px-1.5 text-[11.5px] leading-none"
      style={{
        borderColor: 'rgb(128 128 128 / 0.4)',
        background: active ? 'rgb(128 128 128 / 0.28)' : 'transparent',
        color: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function NavButton({ children, onClick, label, testid }: { children: React.ReactNode; onClick(): void; label: string; testid: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      data-testid={testid}
      className="h-9 shrink-0 rounded-md border px-3 text-[13px] font-medium"
      style={{ borderColor: 'rgb(128 128 128 / 0.45)', background: 'rgb(128 128 128 / 0.14)', color: 'inherit' }}
    >
      {children}
    </button>
  );
}
