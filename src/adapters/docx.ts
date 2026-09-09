import mammoth from 'mammoth';
import type { LoadedDocument, Page } from '../types';
import { sanitizeHtml } from '../lib/sanitize';

/**
 * DOCX is converted to HTML locally with mammoth, sanitized, then split into
 * pages on top-level headings. Macros and embedded objects are discarded by
 * the converter and again by the sanitizer.
 */
export async function loadDocx(file: File): Promise<LoadedDocument> {
  let html = '';
  try {
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    html = sanitizeHtml(res.value);
  } catch {
    throw new Error('This Word file could not be read. It may be a legacy .doc, corrupt, or password protected.');
  }
  if (!html.trim()) throw new Error('This document appears to be empty.');

  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const root = doc.getElementById('r')!;
  const pages: Page[] = [];
  let buffer: Element[] = [];
  let title = file.name.replace(/\.docx$/i, '');

  const flush = () => {
    if (!buffer.length) return;
    const heading = buffer.find((el) => /^H[1-3]$/.test(el.tagName));
    pages.push({
      index: pages.length,
      title: (heading?.textContent || `Section ${pages.length + 1}`).trim().slice(0, 80),
      render: { type: 'html', html: buffer.map((el) => el.outerHTML).join('') },
    });
    buffer = [];
  };

  for (const el of [...root.children]) {
    if (/^H[12]$/.test(el.tagName) && buffer.length) flush();
    buffer.push(el);
    // Keep pages readable when a document has no headings at all.
    if (buffer.reduce((n, x) => n + (x.textContent?.length ?? 0), 0) > 2200) flush();
  }
  flush();
  if (pages.length && pages[0].title) title = pages[0].title;

  return {
    kind: 'doc',
    title,
    pages: pages.length ? pages : [{ index: 0, title, render: { type: 'html', html } }],
    notices: ['Word files are paginated by heading, so page breaks will not match Word exactly.'],
  };
}
