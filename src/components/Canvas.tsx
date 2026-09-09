import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

import type { Page } from '../types';

export type ZoomMode = 'fit' | 'width' | number;

interface Props {
  page: Page | null;
  zoom: ZoomMode;
  onTripleClick(): void;
}

export function Canvas({ page, zoom, onTripleClick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Selection length before the click sequence began, captured on mousedown. */
  const selectionBefore = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.detail === 1) selectionBefore.current = window.getSelection()?.toString().length ?? 0;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.detail !== 3) return;
    const el = e.target as HTMLElement;
    // Never fight with a control, a media element, or a live text selection.
    if (el.closest('button, a, input, textarea, select, video, audio, [data-no-triple]')) return;
    const inText = Boolean(el.closest('.doc-html, [data-selectable]'));
    if (inText && selectionBefore.current > 0) return;
    if (inText) return; // triple-click is the browser's select-paragraph gesture here
    // A triple click on a slide image selects nothing meaningful: drop it and open.
    window.getSelection()?.removeAllRanges();
    onTripleClick();
  };

  return (
    <div
      ref={wrapRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      data-testid="canvas"
      className="pd-scroll relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--bg)] p-4"
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
        <article data-selectable className="mx-auto max-h-full w-full max-w-[900px] overflow-auto pd-scroll rounded-lg border border-[var(--line)] bg-[var(--surface)] p-10">
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
