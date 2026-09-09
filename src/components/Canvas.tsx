import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

import type { Page } from '../types';

export type ZoomMode = 'fit' | 'width' | number;

interface Props {
  page: Page | null;
  zoom: ZoomMode;
  /** Presenting: no padding, no app background, slide edge to edge. */
  bare?: boolean;
}

export function Canvas({ page, zoom, bare = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapRef}
      data-testid="canvas"
      className={`pd-scroll relative flex min-h-0 flex-1 items-center justify-center overflow-auto ${
        bare ? 'bg-black p-0' : 'bg-[var(--bg)] p-4'
      }`}
    >
      {page ? <PageView page={page} zoom={zoom} /> : null}
    </div>
  );
}

function PageView({ page, zoom }: { page: Page; zoom: ZoomMode }) {
  switch (page.render.type) {
    case 'pdf':
      return <PdfPage pageNumber={page.render.pageNumber} zoom={zoom} />;
    case 'image':
      return (
        <img
          src={page.render.url}
          alt={page.title}
          className={zoom === 'width' ? 'w-full' : 'max-h-full max-w-full object-contain'}
          style={typeof zoom === 'number' ? { width: `${zoom * 100}%`, maxHeight: 'none' } : undefined}
        />
      );
    case 'web':
      return <WebDeck url={page.render.url} index={page.render.index} />;
    case 'slide':
      return <SlidePage html={page.render.html} width={page.render.width} height={page.render.height} zoom={zoom} />;
    case 'html':
      return (
        <div className="h-full w-full overflow-auto pd-scroll">
          <div
            className="doc-html mx-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-10"
            style={{ fontSize: typeof zoom === 'number' ? `${zoom}rem` : '1rem' }}
            dangerouslySetInnerHTML={{ __html: page.render.html }}
          />
        </div>
      );
    case 'text':
      return (
        <article className="mx-auto max-h-full w-full max-w-[900px] overflow-auto pd-scroll rounded-lg border border-[var(--line)] bg-[var(--surface)] p-10">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">{page.render.title}</h2>
          {page.render.body.map((line, i) => (
            <p key={i} className="mb-2.5 max-w-[68ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
              {line}
            </p>
          ))}
        </article>
      );
    case 'media':
      return <MediaPage url={page.render.url} audio={page.render.audio} />;
    case 'screen':
      return <ScreenPreview />;
    default:
      return null;
  }
}

/**
 * A self-contained HTML deck, shown live in a sandboxed frame. Navigation is
 * handed to the deck itself: its own go/next/prev functions when it exposes
 * them, arrow keys otherwise. If the presenter clicks inside the deck and moves
 * it directly, the app notices and keeps the teleprompter in step.
 */
function WebDeck({ url, index }: { url: string; index: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const applied = useRef(0);
  const goto = useStore((s) => s.goto);

  useEffect(() => {
    const win = ref.current?.contentWindow as (Window & Record<string, unknown>) | null | undefined;
    if (!win) return;
    if (index === applied.current) return;
    const delta = index - applied.current;
    applied.current = index;

    const press = (key: string, times: number) => {
      for (let i = 0; i < times; i++) {
        try {
          const Ctor = win.KeyboardEvent as typeof KeyboardEvent;
          win.document.dispatchEvent(new Ctor('keydown', { key, bubbles: true }));
        } catch {
          /* the deck may not be ready yet */
        }
      }
    };

    try {
      const go = win.go as ((i: number) => void) | undefined;
      const next = win.next as (() => void) | undefined;
      const prev = win.prev as (() => void) | undefined;
      if (typeof go === 'function') go(index);
      else if (delta > 0 && typeof next === 'function') for (let i = 0; i < delta; i++) next();
      else if (delta < 0 && typeof prev === 'function') for (let i = 0; i < -delta; i++) prev();
      else press(delta > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(delta));
    } catch {
      press(delta > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(delta));
    }
  }, [index]);

  // The deck may also be driven from inside: watch where it actually is.
  useEffect(() => {
    const read = () => {
      const win = ref.current?.contentWindow as (Window & Record<string, unknown>) | null | undefined;
      if (!win) return null;
      try {
        const cur = win.cur;
        if (typeof cur === 'number' && Number.isFinite(cur)) return cur;
        const slides = [...win.document.querySelectorAll('[data-slide], section.slide, .slide, .step, section')];
        const active = slides.findIndex((el) => /(^|\s)(active|current|is-active|present)(\s|$)/.test(el.className));
        return active >= 0 ? active : null;
      } catch {
        return null;
      }
    };
    const timer = setInterval(() => {
      const where = read();
      if (where === null || where === applied.current) return;
      applied.current = where;
      goto(where);
    }, 350);
    return () => clearInterval(timer);
  }, [goto]);

  return (
    <iframe
      ref={ref}
      src={url}
      title="Presentation"
      data-no-triple
      // The file is the presenter's own, opened deliberately, and it needs its
      // own origin to run and to be driven. It is still framed and sandboxed.
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
}

/** A rebuilt PPTX slide: drawn at its real size, then scaled to the stage. */
function SlidePage({ html, width, height, zoom }: { html: string; width: number; height: number; zoom: ZoomMode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box) return;
      if (typeof zoom === 'number') setScale(zoom);
      else if (zoom === 'width') setScale(box.width / width);
      else setScale(Math.min(box.width / width, box.height / height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [width, height, zoom]);

  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center overflow-auto">
      <div
        style={{ width: width * scale, height: height * scale, flex: '0 0 auto' }}
        className="shadow-[var(--shadow)]"
      >
        <div
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

function PdfPage({ pageNumber, zoom }: { pageNumber: number; zoom: ZoomMode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let task: { cancel(): void } | null = null;

    const draw = async () => {
      const { activePdf } = await import('../adapters/pdfRuntime');
      const pdf = activePdf();
      const canvas = ref.current;
      const box = boxRef.current;
      if (!pdf || !canvas || !box) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const unit = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const avail = box.getBoundingClientRect();
        let scale: number;
        if (zoom === 'fit') scale = Math.min(avail.width / unit.width, avail.height / unit.height);
        else if (zoom === 'width') scale = avail.width / unit.width;
        else scale = zoom;
        scale = Math.max(0.1, scale);
        const viewport = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({ canvasContext: ctx, viewport });
        await (task as unknown as { promise: Promise<void> }).promise;
        setError('');
      } catch (err) {
        if (!cancelled && (err as { name?: string }).name !== 'RenderingCancelledException') {
          setError('This page could not be drawn.');
        }
      }
    };

    void draw();
    const ro = new ResizeObserver(() => void draw());
    if (boxRef.current) ro.observe(boxRef.current);
    return () => {
      cancelled = true;
      task?.cancel();
      ro.disconnect();
    };
  }, [pageNumber, zoom]);

  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center">
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <canvas ref={ref} className="rounded shadow-[var(--shadow)]" aria-label={`Page ${pageNumber}`} />
    </div>
  );
}

function MediaPage({ url, audio }: { url: string; audio: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const setMediaController = useStore((s) => s.setMediaController);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setMediaController({
      play: () => void el.play().catch(() => undefined),
      pause: () => el.pause(),
      seek: (d) => {
        el.currentTime = Math.max(0, el.currentTime + d);
      },
      rate: (r) => {
        el.playbackRate = r;
      },
    });
    return () => setMediaController(null);
  }, [setMediaController]);

  return audio ? (
    <div className="w-full max-w-[640px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8">
      <audio ref={ref} src={url} controls className="w-full" />
    </div>
  ) : (
    <video ref={ref} src={url} controls className="max-h-full max-w-full bg-black" />
  );
}

function ScreenPreview() {
  const stream = useStore((s) => s.doc?.pages[0]?.render.type === 'screen');
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    const s = (window as unknown as { __pdScreenStream?: MediaStream }).__pdScreenStream;
    if (el && s) el.srcObject = s;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="max-h-full max-w-full rounded bg-black" />;
}
