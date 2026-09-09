import type { LoadedDocument, Page } from '../types';

/** Selectors decks use for a slide, most specific first. */
const SLIDE_SELECTORS = ['[data-slide]', 'section.slide', '.slide', '.step', '.reveal section', 'section'];

/**
 * A self-contained HTML deck runs its own code, so it is shown live in a
 * sandboxed frame rather than being taken apart. The slide elements are counted
 * up front, without running anything, so the page count and the teleprompter
 * mapping are known before the deck loads.
 */
export async function loadHtml(file: File): Promise<LoadedDocument> {
  const text = await file.text();
  const parsed = new DOMParser().parseFromString(text, 'text/html');

  let nodes: Element[] = [];
  for (const selector of SLIDE_SELECTORS) {
    const found = [...parsed.querySelectorAll(selector)];
    if (found.length > 1) {
      nodes = found;
      break;
    }
  }

  const count = Math.max(1, nodes.length);
  const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
  const pages: Page[] = Array.from({ length: count }, (_, i) => {
    const heading = nodes[i]?.querySelector('h1, h2, h3, .title')?.textContent?.trim() ?? '';
    return {
      index: i,
      title: heading.slice(0, 80) || `Slide ${i + 1}`,
      render: { type: 'web', url, index: i },
    };
  });

  return {
    kind: 'web',
    title: parsed.title?.trim() || file.name.replace(/\.html?$/i, ''),
    pages,
    notices: [
      count > 1
        ? 'This deck runs its own code in a sandboxed frame. Next and Previous drive it, and it stays in step if you click inside it too.'
        : 'No separate slides were found in this file, so it is shown as one page.',
    ],
  };
}
