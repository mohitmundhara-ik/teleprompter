import type { LoadedDocument } from '../types';

export function loadImage(file: File): LoadedDocument {
  const url = URL.createObjectURL(file);
  return {
    kind: 'image',
    title: file.name,
    pages: [{ index: 0, title: file.name, render: { type: 'image', url } }],
    notices: file.type === 'image/svg+xml'
      ? ['SVG files are drawn as images, so any script inside them never runs.']
      : [],
  };
}

export function loadImages(files: File[]): LoadedDocument {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return {
    kind: 'image',
    title: `${sorted.length} images`,
    pages: sorted.map((f, i) => ({ index: i, title: f.name, render: { type: 'image', url: URL.createObjectURL(f) } })),
    notices: [],
  };
}

export function loadMedia(file: File): LoadedDocument {
  const audio = file.type.startsWith('audio/');
  const url = URL.createObjectURL(file);
  return {
    kind: audio ? 'audio' : 'video',
    title: file.name,
    pages: [{ index: 0, title: file.name, render: { type: 'media', url, mime: file.type, audio } }],
    notices: [],
  };
}

/** Plain text and Markdown become one page per blank-line-separated block set. */
export async function loadText(file: File): Promise<LoadedDocument> {
  const text = await file.text();
  const chunks = text.split(/\n(?=#{1,3}\s)/g).filter((c) => c.trim());
  const pages = (chunks.length ? chunks : [text]).map((chunk, i) => {
    const lines = chunk.split('\n').filter((l) => l.trim());
    const title = (lines[0] ?? `Section ${i + 1}`).replace(/^#+\s*/, '').slice(0, 80);
    return {
      index: i,
      title,
      render: { type: 'text' as const, title, body: lines.slice(1).map((l) => l.replace(/^[#>*-]\s*/, '')) },
    };
  });
  return { kind: 'text', title: file.name, pages, notices: [] };
}
