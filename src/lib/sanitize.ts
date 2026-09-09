const ALLOWED = new Set([
  'A','B','BLOCKQUOTE','BR','CAPTION','CODE','COL','COLGROUP','DD','DIV','DL','DT','EM','FIGCAPTION','FIGURE',
  'H1','H2','H3','H4','H5','H6','HR','I','IMG','LI','OL','P','PRE','S','SPAN','STRONG','SUB','SUP','TABLE',
  'TBODY','TD','TFOOT','TH','THEAD','TR','U','UL',
]);
const ALLOWED_ATTR = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);

/**
 * Allowlist sanitizer for HTML produced by document conversion. Elements
 * outside the list are unwrapped, all event handlers, styles, scripts, embeds
 * and non-http(s)/data-image URLs are dropped. Nothing from an imported
 * document is ever executed.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      walk(child);
      if (!ALLOWED.has(child.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'].includes(child.tagName)) {
          child.remove();
        } else {
          child.replaceWith(...child.childNodes);
        }
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        const badUrl =
          (name === 'href' || name === 'src') &&
          !/^(https?:|mailto:|#|data:image\/(png|jpe?g|gif|webp);base64,)/i.test(value);
        if (!ALLOWED_ATTR.has(name) || badUrl) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'A') {
        child.setAttribute('rel', 'noopener noreferrer');
        child.setAttribute('target', '_blank');
      }
    }
  };
  walk(root);
  return root.innerHTML;
}
