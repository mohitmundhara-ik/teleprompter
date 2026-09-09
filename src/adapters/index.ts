import type { LoadedDocument } from '../types';

/* Heavy parsers are loaded on demand, so the teleprompter window and a plain
   image session never download the PDF, DOCX and PPTX engines. */
const pdfMod = () => import('./pdf');
const docxMod = () => import('./docx');
const pptxMod = () => import('./pptx');
const simpleMod = () => import('./simple');

export interface ImportResult {
  doc: LoadedDocument;
  /** Notes discovered inside the file, keyed by zero-based page index. */
  notes?: Map<number, string>;
}

export const SUPPORTED = [
  { label: 'PDF', ext: '.pdf', fidelity: 'Exact' },
  { label: 'PowerPoint', ext: '.pptx', fidelity: 'Text and notes, or exact with a converter' },
  { label: 'Word', ext: '.docx', fidelity: 'Text, headings, lists and tables' },
  { label: 'Images', ext: '.png .jpg .jpeg .webp .gif .svg', fidelity: 'Exact' },
  { label: 'Video', ext: '.mp4 .webm', fidelity: 'Exact' },
  { label: 'Audio', ext: '.mp3 .wav .m4a', fidelity: 'Exact' },
  { label: 'Text', ext: '.txt .md', fidelity: 'Exact' },
];

export const ACCEPT =
  '.pdf,.pptx,.ppt,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.webm,.mp3,.wav,.m4a,image/*,video/*,audio/*';

export const MAX_BYTES = 512 * 1024 * 1024;

const ext = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

export async function importFiles(
  files: File[],
  opts: { allowConversion: boolean; onProgress?: (pct: number, label: string) => void },
): Promise<ImportResult> {
  if (!files.length) throw new Error('No file was selected.');
  const images = files.filter((f) => f.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext(f.name)));
  if (images.length > 1 && images.length === files.length) return { doc: (await simpleMod()).loadImages(images) };

  const file = files[0];
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 512 MB. Split it or compress it first.`);
  const e = ext(file.name);

  if (e === 'pdf') return { doc: await (await pdfMod()).loadPdf(file, (p) => opts.onProgress?.(p, 'Reading pages')) };
  if (e === 'pptx' || e === 'ppt') {
    const r = await (await pptxMod()).loadPptx(file, opts);
    return { doc: r, notes: r.notes };
  }
  if (e === 'docx') return { doc: await (await docxMod()).loadDocx(file) };
  if (e === 'doc') throw new Error('Legacy .doc cannot be read in a browser. Save it as .docx or PDF first.');
  if (['txt', 'md', 'markdown'].includes(e)) return { doc: await (await simpleMod()).loadText(file) };
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(e)) return { doc: (await simpleMod()).loadImage(file) };
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(e)) return { doc: (await simpleMod()).loadMedia(file) };
  if (file.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(e)) return { doc: (await simpleMod()).loadMedia(file) };

  throw new Error(`${file.name} is not a supported format. Supported: PDF, PPTX, DOCX, images, video, audio, TXT and MD.`);
}
