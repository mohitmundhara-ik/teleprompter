/**
 * Draws PPTX slides in the browser.
 *
 * A .pptx has no slide images inside it: each slide is a tree of shapes with
 * positions in EMU, text runs, fills and picture references, and anything the
 * slide does not state itself is inherited from its layout and then the master.
 * This module walks that tree and rebuilds each slide as absolutely positioned
 * HTML at the deck's real dimensions, which the canvas then scales to fit.
 *
 * It covers what ordinary decks are made of: text boxes, placeholders, solid
 * fills, outlines, pictures, groups, tables and slide backgrounds. It does not
 * attempt gradients, shadows, charts, SmartArt or custom geometry; those areas
 * are left empty rather than drawn wrongly. For exact output, use the
 * converter described in the README.
 */
import type JSZip from 'jszip';

const EMU_PX = 9525; // 914400 EMU per inch at 96 dpi
const px = (emu: number) => emu / EMU_PX;
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type El = Element;
const kids = (el: El | null, name: string): El[] =>
  el ? [...el.children].filter((c) => c.nodeName === name || c.localName === name.split(':')[1]) : [];
const kid = (el: El | null, name: string): El | null => kids(el, name)[0] ?? null;
/** First descendant with this qualified name. */
const deep = (el: El | null, name: string): El | null =>
  el ? (el.getElementsByTagName(name)[0] ?? null) : null;

export interface SlideVisual {
  html: string;
  width: number;
  height: number;
  title: string;
}

interface Ctx {
  zip: JSZip;
  theme: Record<string, string>;
  media: Map<string, string>;
  parse(path: string): Promise<Document | null>;
}

const parser = new DOMParser();

export async function renderPptx(zip: JSZip): Promise<SlideVisual[]> {
  const cache = new Map<string, Document | null>();
  const parse = async (path: string) => {
    if (cache.has(path)) return cache.get(path)!;
    const f = zip.file(path);
    const doc = f ? parser.parseFromString(await f.async('string'), 'application/xml') : null;
    cache.set(path, doc);
    return doc;
  };

  const pres = await parse('ppt/presentation.xml');
  const sz = deep(pres?.documentElement ?? null, 'p:sldSz');
  const width = px(Number(sz?.getAttribute('cx') ?? 12192000));
  const height = px(Number(sz?.getAttribute('cy') ?? 6858000));

  const ctx: Ctx = { zip, theme: await readTheme(parse), media: new Map(), parse };

  const slidePaths = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const out: SlideVisual[] = [];
  for (const path of slidePaths) {
    out.push(await renderSlide(ctx, path, width, height));
  }
  return out;
}

async function readTheme(parse: Ctx['parse']): Promise<Record<string, string>> {
  const doc = await parse('ppt/theme/theme1.xml');
  const scheme = deep(doc?.documentElement ?? null, 'a:clrScheme');
  const map: Record<string, string> = {};
  if (scheme) {
    for (const entry of [...scheme.children]) {
      const name = entry.localName ?? '';
      const srgb = kid(entry, 'a:srgbClr')?.getAttribute('val');
      const sys = kid(entry, 'a:sysClr')?.getAttribute('lastClr');
      const value = srgb ?? sys;
      if (value) map[name] = `#${value}`;
    }
  }
  // The usual document mapping, good enough without reading the master's clrMap.
  map.tx1 ??= map.dk1 ?? '#000000';
  map.bg1 ??= map.lt1 ?? '#ffffff';
  map.tx2 ??= map.dk2 ?? '#000000';
  map.bg2 ??= map.lt2 ?? '#ffffff';
  return map;
}

async function relTargets(ctx: Ctx, partPath: string): Promise<Map<string, string>> {
  const dir = partPath.slice(0, partPath.lastIndexOf('/'));
  const rels = await ctx.parse(`${dir}/_rels/${partPath.slice(partPath.lastIndexOf('/') + 1)}.rels`);
  const map = new Map<string, string>();
  if (!rels) return map;
  for (const r of [...rels.getElementsByTagName('Relationship')]) {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (!id || !target) continue;
    map.set(id, normalize(dir, target));
  }
  return map;
}

function normalize(dir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = `${dir}/${target}`.split('/');
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}

async function mediaUrl(ctx: Ctx, path: string): Promise<string | null> {
  if (ctx.media.has(path)) return ctx.media.get(path)!;
  const file = ctx.zip.file(path);
  if (!file) return null;
  const ext = (path.split('.').pop() ?? 'png').toLowerCase();
  const mime =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'gif' ? 'image/gif'
    : ext === 'svg' ? 'image/svg+xml'
    : ext === 'webp' ? 'image/webp'
    : 'image/png';
  const url = URL.createObjectURL(new Blob([await file.async('blob')], { type: mime }));
  ctx.media.set(path, url);
  return url;
}

async function renderSlide(ctx: Ctx, path: string, width: number, height: number): Promise<SlideVisual> {
  const doc = await ctx.parse(path);
  const rels = await relTargets(ctx, path);
  const layoutPath = [...rels.values()].find((v) => v.includes('slideLayouts/'));
  const layoutDoc = layoutPath ? await ctx.parse(layoutPath) : null;
  const layoutRels = layoutPath ? await relTargets(ctx, layoutPath) : new Map<string, string>();
  const masterPath = [...layoutRels.values()].find((v) => v.includes('slideMasters/'));
  const masterDoc = masterPath ? await ctx.parse(masterPath) : null;

  const placeholders = [
    ...collectPlaceholders(layoutDoc),
    ...collectPlaceholders(masterDoc),
  ];

  const background = resolveBackground(ctx, doc) ?? resolveBackground(ctx, layoutDoc) ?? resolveBackground(ctx, masterDoc) ?? '#ffffff';
  const parts: string[] = [];
  let title = '';

  const walk = async (
    root: El | null,
    partPath: string,
    dx: number,
    dy: number,
    sx: number,
    sy: number,
    skipPlaceholders = false,
  ) => {
    if (!root) return;
    for (const node of [...root.children]) {
      const tag = node.localName ?? '';
      if (skipPlaceholders && deep(node, 'p:ph')) continue;
      if (tag === 'sp') {
        const piece = await shapeHtml(ctx, node, placeholders, dx, dy, sx, sy);
        if (piece) {
          parts.push(piece.html);
          if (!title && piece.text && piece.isTitle) title = piece.text;
          if (!title && piece.text) title = piece.text;
        }
      } else if (tag === 'pic') {
        parts.push(await pictureHtml(ctx, node, partPath, dx, dy, sx, sy));
      } else if (tag === 'graphicFrame') {
        parts.push(tableHtml(ctx, node, dx, dy, sx, sy));
      } else if (tag === 'grpSp') {
        const xf = kid(node, 'a:xfrm') ?? deep(node, 'a:xfrm');
        const off = kid(xf, 'a:off');
        const ext = kid(xf, 'a:ext');
        const chOff = kid(xf, 'a:chOff');
        const chExt = kid(xf, 'a:chExt');
        const gx = px(Number(off?.getAttribute('x') ?? 0));
        const gy = px(Number(off?.getAttribute('y') ?? 0));
        const gw = px(Number(ext?.getAttribute('cx') ?? 0));
        const gh = px(Number(ext?.getAttribute('cy') ?? 0));
        const cx = px(Number(chOff?.getAttribute('x') ?? 0));
        const cy = px(Number(chOff?.getAttribute('y') ?? 0));
        const cw = px(Number(chExt?.getAttribute('cx') ?? 0)) || gw || 1;
        const ch = px(Number(chExt?.getAttribute('cy') ?? 0)) || gh || 1;
        const nsx = sx * (gw / cw || 1);
        const nsy = sy * (gh / ch || 1);
        await walk(node, partPath, dx + gx * sx - cx * nsx, dy + gy * sy - cy * nsy, nsx, nsy, skipPlaceholders);
      }
    }
  };

  // Anything the master and layout draw sits behind the slide's own shapes.
  // Their placeholders are skipped: the slide fills those itself.
  const showMaster = doc?.documentElement.getAttribute('showMasterSp') !== '0';
  if (showMaster && masterPath && masterDoc) {
    await walk(deep(masterDoc.documentElement, 'p:spTree'), masterPath, 0, 0, 1, 1, true);
  }
  if (showMaster && layoutPath && layoutDoc) {
    await walk(deep(layoutDoc.documentElement, 'p:spTree'), layoutPath, 0, 0, 1, 1, true);
  }
  await walk(deep(doc?.documentElement ?? null, 'p:spTree'), path, 0, 0, 1, 1);

  const html =
    `<div class="pptx-slide" style="width:${width}px;height:${height}px;background:${background}">` +
    parts.join('') +
    '</div>';
  return { html, width, height, title: title.slice(0, 80) };
}

interface Placeholder {
  type: string;
  idx: string;
  el: El;
}

function collectPlaceholders(doc: Document | null): Placeholder[] {
  const tree = deep(doc?.documentElement ?? null, 'p:spTree');
  if (!tree) return [];
  const out: Placeholder[] = [];
  for (const sp of [...tree.getElementsByTagName('p:sp')]) {
    const ph = deep(sp, 'p:ph');
    if (!ph) continue;
    out.push({ type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') ?? '', el: sp });
  }
  return out;
}

function frameOf(sp: El | null): { x: number; y: number; w: number; h: number; rot: number } | null {
  const xf = deep(sp, 'a:xfrm');
  const off = kid(xf, 'a:off');
  const ext = kid(xf, 'a:ext');
  if (!off || !ext) return null;
  return {
    x: px(Number(off.getAttribute('x') ?? 0)),
    y: px(Number(off.getAttribute('y') ?? 0)),
    w: px(Number(ext.getAttribute('cx') ?? 0)),
    h: px(Number(ext.getAttribute('cy') ?? 0)),
    rot: Number(xf?.getAttribute('rot') ?? 0) / 60000,
  };
}

function inherited(sp: El, placeholders: Placeholder[]): El | null {
  const ph = deep(sp, 'p:ph');
  if (!ph) return null;
  const type = ph.getAttribute('type') ?? 'body';
  const idx = ph.getAttribute('idx') ?? '';
  return (
    placeholders.find((p) => p.idx && p.idx === idx)?.el ??
    placeholders.find((p) => p.type === type)?.el ??
    null
  );
}

function color(ctx: Ctx, holder: El | null): string | null {
  if (!holder) return null;
  const srgb = deep(holder, 'a:srgbClr')?.getAttribute('val');
  if (srgb) return `#${srgb}`;
  const scheme = deep(holder, 'a:schemeClr')?.getAttribute('val');
  if (scheme) return ctx.theme[scheme] ?? ctx.theme[scheme.replace('1', '')] ?? null;
  return null;
}

function resolveBackground(ctx: Ctx, doc: Document | null): string | null {
  const bg = deep(doc?.documentElement ?? null, 'p:bg');
  if (!bg) return null;
  const fill = kid(deep(bg, 'p:bgPr'), 'a:solidFill') ?? deep(bg, 'a:solidFill');
  return color(ctx, fill);
}

function fillOf(ctx: Ctx, sp: El | null): string | null {
  const spPr = deep(sp, 'p:spPr');
  if (!spPr) return null;
  if (kid(spPr, 'a:noFill')) return null;
  const solid = kid(spPr, 'a:solidFill');
  return solid ? color(ctx, solid) : null;
}

function outlineOf(ctx: Ctx, sp: El | null): string {
  const ln = kid(deep(sp, 'p:spPr'), 'a:ln');
  if (!ln || kid(ln, 'a:noFill')) return '';
  const stroke = color(ctx, kid(ln, 'a:solidFill'));
  if (!stroke) return '';
  const w = Number(ln.getAttribute('w') ?? 12700) / 12700;
  return `border:${Math.max(1, w).toFixed(1)}px solid ${stroke};`;
}

function radiusOf(sp: El | null): string {
  const prst = deep(sp, 'a:prstGeom')?.getAttribute('prst') ?? '';
  if (prst === 'ellipse') return 'border-radius:50%;';
  if (prst.startsWith('round')) return 'border-radius:10px;';
  return '';
}

const ALIGN: Record<string, string> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
const ANCHOR: Record<string, string> = { t: 'flex-start', ctr: 'center', b: 'flex-end' };

function textHtml(ctx: Ctx, sp: El, fallbackSize: number): { html: string; text: string } {
  const body = deep(sp, 'p:txBody');
  if (!body) return { html: '', text: '' };
  const paras: string[] = [];
  const plain: string[] = [];

  for (const p of [...body.getElementsByTagName('a:p')]) {
    const pPr = kid(p, 'a:pPr');
    const align = ALIGN[pPr?.getAttribute('algn') ?? ''] ?? '';
    const level = Number(pPr?.getAttribute('lvl') ?? 0);
    const bullet = Boolean(kid(pPr, 'a:buChar') || kid(pPr, 'a:buAutoNum'));
    const runs: string[] = [];
    let line = '';

    for (const r of [...p.getElementsByTagName('a:r')]) {
      const rPr = kid(r, 'a:rPr');
      const t = kid(r, 'a:t')?.textContent ?? '';
      if (!t) continue;
      line += t;
      const size = Number(rPr?.getAttribute('sz') ?? 0) / 75 || fallbackSize;
      const bold = rPr?.getAttribute('b') === '1';
      const italic = rPr?.getAttribute('i') === '1';
      const underline = Boolean(rPr?.getAttribute('u') && rPr.getAttribute('u') !== 'none');
      const fg = color(ctx, kid(rPr, 'a:solidFill'));
      const face = deep(rPr, 'a:latin')?.getAttribute('typeface');
      const style =
        `font-size:${size.toFixed(1)}px;` +
        (bold ? 'font-weight:700;' : '') +
        (italic ? 'font-style:italic;' : '') +
        (underline ? 'text-decoration:underline;' : '') +
        (fg ? `color:${fg};` : '') +
        (face && !/\+mn|\+mj/.test(face) ? `font-family:'${esc(face)}',sans-serif;` : '');
      runs.push(`<span style="${style}">${esc(t)}</span>`);
    }

    if (!runs.length) {
      paras.push('<p style="margin:0;height:0.6em"></p>');
      continue;
    }
    plain.push(line);
    paras.push(
      `<p style="margin:0 0 0.28em;${align ? `text-align:${align};` : ''}${level ? `padding-left:${level * 18}px;` : ''}">` +
        (bullet ? '<span style="opacity:.75">&#8226; </span>' : '') +
        runs.join('') +
        '</p>',
    );
  }

  return { html: paras.join(''), text: plain.join(' ') };
}

async function shapeHtml(
  ctx: Ctx,
  sp: El,
  placeholders: Placeholder[],
  dx: number,
  dy: number,
  sx: number,
  sy: number,
): Promise<{ html: string; text: string; isTitle: boolean } | null> {
  const source = inherited(sp, placeholders);
  const frame = frameOf(sp) ?? (source ? frameOf(source) : null);
  if (!frame) return null;

  const phType = deep(sp, 'p:ph')?.getAttribute('type') ?? '';
  const isTitle = phType === 'title' || phType === 'ctrTitle';
  const fallbackSize = isTitle ? 40 : 18;
  const { html: inner, text } = textHtml(ctx, sp, fallbackSize);
  const fill = fillOf(ctx, sp) ?? (source && deep(sp, 'p:spPr') && !kid(deep(sp, 'p:spPr'), 'a:noFill') ? null : null);
  const bodyPr = deep(sp, 'p:bodyPr');
  const anchor = ANCHOR[bodyPr?.getAttribute('anchor') ?? 't'] ?? 'flex-start';
  if (!inner && !fill) return null;

  const style =
    `position:absolute;left:${(dx + frame.x * sx).toFixed(1)}px;top:${(dy + frame.y * sy).toFixed(1)}px;` +
    `width:${(frame.w * sx).toFixed(1)}px;height:${(frame.h * sy).toFixed(1)}px;` +
    `display:flex;flex-direction:column;justify-content:${anchor};padding:6px 9px;overflow:hidden;` +
    (fill ? `background:${fill};` : '') +
    outlineOf(ctx, sp) +
    radiusOf(sp) +
    (frame.rot ? `transform:rotate(${frame.rot}deg);` : '');

  return { html: `<div style="${style}">${inner}</div>`, text, isTitle };
}

async function pictureHtml(ctx: Ctx, pic: El, slidePath: string, dx: number, dy: number, sx: number, sy: number) {
  const frame = frameOf(pic);
  const embed = deep(pic, 'a:blip')?.getAttribute('r:embed');
  if (!frame || !embed) return '';
  const rels = await relTargets(ctx, slidePath);
  const target = rels.get(embed);
  const url = target ? await mediaUrl(ctx, target) : null;
  if (!url) return '';

  // PowerPoint can crop a picture with srcRect, given as fractions of the
  // source in thousandths of a percent. Reproduce it with an overflow window
  // and an oversized image inside, or the visible part comes out too small.
  const src = deep(pic, 'a:srcRect');
  const frac = (name: string) => Number(src?.getAttribute(name) ?? 0) / 100000;
  const [l, t, r, b] = [frac('l'), frac('t'), frac('r'), frac('b')];
  const w = frame.w * sx;
  const h = frame.h * sy;
  const box =
    `position:absolute;left:${(dx + frame.x * sx).toFixed(1)}px;top:${(dy + frame.y * sy).toFixed(1)}px;` +
    `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;overflow:hidden;` +
    (frame.rot ? `transform:rotate(${frame.rot}deg);` : '');

  if (!l && !t && !r && !b) {
    return `<div style="${box}"><img src="${url}" alt="" style="width:100%;height:100%;object-fit:fill" /></div>`;
  }
  const iw = w / Math.max(0.01, 1 - l - r);
  const ih = h / Math.max(0.01, 1 - t - b);
  return (
    `<div style="${box}">` +
    `<img src="${url}" alt="" style="position:absolute;left:${(-l * iw).toFixed(1)}px;top:${(-t * ih).toFixed(1)}px;` +
    `width:${iw.toFixed(1)}px;height:${ih.toFixed(1)}px;object-fit:fill" />` +
    '</div>'
  );
}

function tableHtml(ctx: Ctx, frameEl: El, dx: number, dy: number, sx: number, sy: number) {
  const tbl = deep(frameEl, 'a:tbl');
  const xf = deep(frameEl, 'a:xfrm');
  const off = kid(xf, 'a:off');
  const ext = kid(xf, 'a:ext');
  if (!tbl || !off || !ext) return '';
  const rows: string[] = [];
  for (const tr of [...tbl.getElementsByTagName('a:tr')]) {
    const cells: string[] = [];
    for (const tc of [...tr.getElementsByTagName('a:tc')]) {
      const cellFill = color(ctx, kid(deep(tc, 'a:tcPr'), 'a:solidFill'));
      const text = [...tc.getElementsByTagName('a:t')].map((t) => t.textContent ?? '').join('');
      cells.push(
        `<td style="border:1px solid rgba(128,128,128,.5);padding:4px 7px;font-size:14px;${cellFill ? `background:${cellFill};` : ''}">${esc(text)}</td>`,
      );
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return (
    `<table style="position:absolute;left:${(dx + px(Number(off.getAttribute('x'))) * sx).toFixed(1)}px;` +
    `top:${(dy + px(Number(off.getAttribute('y'))) * sy).toFixed(1)}px;` +
    `width:${(px(Number(ext.getAttribute('cx'))) * sx).toFixed(1)}px;border-collapse:collapse;">` +
    rows.join('') +
    '</table>'
  );
}
