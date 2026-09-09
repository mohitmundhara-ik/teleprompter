export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** A marker line and everything said on it, resolved to the pages it covers. */
export interface ScriptBlock {
  /** First page this block belongs to, zero-based. Null before any marker. */
  slide: number | null;
  /** Last page for a range such as "Slides 5-28". Equals slide otherwise. */
  slideEnd: number | null;
  /** Whatever followed the number on the marker line. */
  title: string;
  text: string;
}

/**
 * Recognises the ways people actually label a talk track:
 *   Slide 4            SLIDE 4 - TITLE       Slide 4: title
 *   --- Slide 4 ---    ## Slide 4            [Slide 4]
 *   Slides 5-28        Slides 5 to 28        Page 4
 *   Before slide 1     After slide 28
 * The whole line has to be the marker, so a sentence that happens to mention
 * slide 4 is left alone.
 */
const MARKER =
  /^[\s\-=*#[\u25c6>]*\s*(?:(before|after)\s+)?(?:slide|page)s?\s*#?\s*(\d+)\s*(?:(?:[-–—]|to)\s*(\d+))?\s*(?:[-–—:.)\]]+\s*(.*?))?[\s\-=*#\]]*$/i;

/** Rules, banners and blank decoration that should never reach the prompter. */
const DECORATION = /^[\s\-=_*~#]{3,}$/;

export function matchMarker(line: string): { slide: number; slideEnd: number; title: string } | null {
  if (DECORATION.test(line)) return null;
  const m = line.match(MARKER);
  if (!m) return null;
  const start = parseInt(m[2], 10);
  if (!Number.isFinite(start) || start < 1) return null;
  const end = m[3] ? parseInt(m[3], 10) : start;
  const title = (m[4] ?? '').replace(/[\s\-=*#\]]+$/, '').trim();
  return { slide: start - 1, slideEnd: Math.max(start, end) - 1, title };
}

/**
 * Split a script into blocks, keeping the pages each one belongs to. Text
 * before the first marker stays as a block with no slide, so it is available in
 * the full script view without landing on every page.
 */
export function parseScriptBlocks(text: string): ScriptBlock[] {
  const blocks = collectBlocks(text);
  // Text written before the first marker belongs to page one when the script
  // starts at a later slide. When page one has its own marker, that lead-in is
  // a header or a set of instructions and belongs to no page at all.
  const first = blocks[0];
  const firstMarked = blocks.find((b) => b.slide !== null);
  if (first && first.slide === null && firstMarked && firstMarked.slide! > 0) {
    first.slide = 0;
    first.slideEnd = 0;
  }
  return blocks;
}

function collectBlocks(text: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  let current: ScriptBlock = { slide: null, slideEnd: null, title: '', text: '' };
  let buf: string[] = [];

  const flush = () => {
    const body = buf
      .filter((l) => !DECORATION.test(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (body || current.slide !== null) blocks.push({ ...current, text: body });
    buf = [];
  };

  for (const line of text.split('\n')) {
    const m = matchMarker(line);
    if (m) {
      flush();
      current = { slide: m.slide, slideEnd: m.slideEnd, title: m.title, text: '' };
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

/** True when a block belongs on this page, ranges included. */
export const blockCoversSlide = (b: ScriptBlock, index: number) =>
  b.slide !== null && index >= b.slide && index <= (b.slideEnd ?? b.slide);

/** True when a script carries slide markers the teleprompter can follow. */
export const hasSlideMarkers = (text: string) => parseScriptBlocks(text).some((b) => b.slide !== null);

/**
 * Everything said on one page, in the order it was written. Blocks marked
 * "before slide 4" and "after slide 4" belong to page 4 as well.
 */
export function scriptForSlide(blocks: ScriptBlock[], index: number): string {
  return blocks
    .filter((b) => blockCoversSlide(b, index))
    .map((b) => b.text)
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/**
 * Turn one pasted script into per-page notes. Ranges fill every page they
 * cover; text before the first marker is dropped, since it belongs to no page.
 */
export function splitScriptByMarkers(text: string): Map<number, string> {
  const blocks = parseScriptBlocks(text);
  const pages = new Set<number>();
  for (const b of blocks) {
    if (b.slide === null) continue;
    for (let i = b.slide; i <= (b.slideEnd ?? b.slide); i++) pages.add(i);
  }
  const out = new Map<number, string>();
  for (const page of [...pages].sort((a, b) => a - b)) {
    const body = scriptForSlide(blocks, page);
    if (body) out.set(page, body);
  }
  return out;
}
