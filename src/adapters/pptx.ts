import JSZip from 'jszip';
import type { LoadedDocument, Page } from '../types';


import { converterUrl } from '../lib/converter';

function paragraphs(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagName('a:p')]
    .map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent ?? '').join('').trim())
    .filter(Boolean);
}

export interface PptxResult extends LoadedDocument {
  /** Speaker notes keyed by zero-based slide index, imported with the deck. */
  notes: Map<number, string>;
}

/**
 * PPTX has no rasterized slide images inside it, so a browser cannot reproduce
 * the design on its own. Two paths:
 *  1. A first-party converter (server/convert.mjs, LibreOffice) if the user has
 *     configured one and consents. Full visual fidelity.
 *  2. Local text extraction. Slide text and speaker notes, no layout.
 */
export async function loadPptx(
  file: File,
  opts: { allowConversion: boolean; onProgress?: (pct: number, label: string) => void } = { allowConversion: false },
): Promise<PptxResult> {
  const url = converterUrl();
  if (opts.allowConversion && url) {
    opts.onProgress?.(10, 'Converting on your converter service');
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(url.replace(/\/$/, '') + '/convert', { method: 'POST', body });
    if (!res.ok) throw new Error(`The converter rejected the file (${res.status}). Check that it is running.`);
    const pdfBlob = await res.blob();
    opts.onProgress?.(70, 'Rendering slides');
    const { loadPdf } = await import('./pdf');
    const converted = await loadPdf(new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' }));
    const notes = await extractNotes(file).catch(() => new Map<number, string>());
    return { ...converted, kind: 'slides', title: file.name.replace(/\.pptx?$/i, ''), notes, notices: [] };
  }

  if (/\.ppt$/i.test(file.name)) {
    throw new Error(
      'Legacy .ppt cannot be read in a browser. Save it as .pptx or export to PDF, then load that file.',
    );
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch(() => {
    throw new Error('This PowerPoint file could not be opened. It may be corrupt.');
  });
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!slideFiles.length) throw new Error('No slides were found inside this file.');

  const pages: Page[] = [];
  const notes = new Map<number, string>();
  for (const name of slideFiles) {
    const num = Number(name.match(/\d+/)![0]);
    const body = paragraphs(await zip.file(name)!.async('string'));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${num}.xml`);
    if (notesFile) {
      const n = paragraphs(await notesFile.async('string')).filter((t) => t !== String(num));
      if (n.length) notes.set(pages.length, n.join('\n'));
    }
    const title = body[0] || `Slide ${num}`;
    pages.push({ index: pages.length, title, render: { type: 'text', title, body: body.slice(1) } });
    opts.onProgress?.(Math.round((pages.length / slideFiles.length) * 100), 'Reading slides');
  }

  return {
    kind: 'slides',
    title: file.name.replace(/\.pptx$/i, ''),
    pages,
    notes,
    notices: [
      'PowerPoint files store shapes and theme rules, not slide images, so this view shows slide text without the original design. Export the deck to PDF for exact visuals, or configure a converter in Settings.',
    ],
  };
}

async function extractNotes(file: File): Promise<Map<number, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out = new Map<number, string>();
  const names = Object.keys(zip.files).filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  for (const name of names) {
    const num = Number(name.match(/\d+/)![0]);
    const text = paragraphs(await zip.file(name)!.async('string')).filter((t) => t !== String(num)).join('\n');
    if (text) out.set(num - 1, text);
  }
  return out;
}
