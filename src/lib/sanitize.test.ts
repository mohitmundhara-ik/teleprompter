import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('removes scripts and event handlers', () => {
    const out = sanitizeHtml('<p onclick="steal()">hi</p><script>steal()</script>');
    expect(out).toBe('<p>hi</p>');
  });

  it('unwraps disallowed elements but keeps their text', () => {
    const out = sanitizeHtml('<marquee>keep me</marquee>');
    expect(out).toContain('keep me');
    expect(out).not.toContain('marquee');
  });

  it('drops javascript: urls and keeps http links safe', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript');
    const ok = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(ok).toContain('https://example.com');
    expect(ok).toContain('rel="noopener noreferrer"');
  });

  it('keeps document structure such as headings, lists and tables', () => {
    const out = sanitizeHtml('<h2>T</h2><ul><li>a</li></ul><table><tr><td>c</td></tr></table>');
    expect(out).toContain('<h2>T</h2>');
    expect(out).toContain('<li>a</li>');
    expect(out).toContain('<td>c</td>');
  });

  it('strips style attributes and iframes', () => {
    const out = sanitizeHtml('<div style="position:fixed">a</div><iframe src="https://x.test"></iframe>');
    expect(out).not.toContain('style');
    expect(out).not.toContain('iframe');
  });
});
