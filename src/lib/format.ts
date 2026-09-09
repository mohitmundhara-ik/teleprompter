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

/**
 * Split one pasted script into per-page chunks on separator lines such as
 * `--- Slide 2 ---`, `### Slide 2`, or `[Slide 2]`. Returns a map of
 * zero-based page index to text. Text before the first marker becomes page 0.
 */
export function splitScriptByMarkers(text: string): Map<number, string> {
  const out = new Map<number, string>();
  const re = /^\s*(?:-{2,}|#{1,6}|\[|\u25c6|\*{2,})?\s*(?:slide|page)\s*#?\s*(\d+)\s*(?:\]|-{2,}|\*{2,})?\s*$/i;
  let current = 0;
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (body) out.set(current, body);
    buf = [];
  };
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) {
      flush();
      current = Math.max(0, parseInt(m[1], 10) - 1);
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export interface ScriptBlock {
  /** Zero-based page this block belongs to, or null for text before any marker. */
  slide: number | null;
  text: string;
}

/**
 * Split a script into blocks while keeping the slide number each one carries.
 * Used by the teleprompter to follow the deck without the presenter having to
 * split the script by hand.
 */
export function parseScriptBlocks(text: string): ScriptBlock[] {
  const re = /^\s*(?:-{2,}|#{1,6}|\[|\u25c6|\*{2,})?\s*(?:slide|page)\s*#?\s*(\d+)\s*(?:\]|-{2,}|\*{2,})?\s*$/i;
  const blocks: ScriptBlock[] = [];
  let slide: number | null = null;
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (body || slide !== null) blocks.push({ slide, text: body });
    buf = [];
  };
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) {
      flush();
      slide = Math.max(0, parseInt(m[1], 10) - 1);
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

/** True when a script carries slide markers the teleprompter can follow. */
export const hasSlideMarkers = (text: string) => parseScriptBlocks(text).some((b) => b.slide !== null);
