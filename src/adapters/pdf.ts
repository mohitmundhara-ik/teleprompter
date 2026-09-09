import type { LoadedDocument } from '../types';
import { openPdf } from './pdfRuntime';

export async function loadPdf(file: File, onProgress?: (pct: number) => void): Promise<LoadedDocument> {
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await openPdf(buf);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'PasswordException') throw new Error('This PDF is password protected. Remove the password and try again.');
    throw new Error('This PDF could not be opened. It may be corrupt or incomplete.');
  }
  const pages: LoadedDocument['pages'] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pages.push({ index: i - 1, title: `Page ${i}`, render: { type: 'pdf', pageNumber: i } });
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }
  return { kind: 'pdf', title: file.name.replace(/\.pdf$/i, ''), pages, notices: [] };
}
