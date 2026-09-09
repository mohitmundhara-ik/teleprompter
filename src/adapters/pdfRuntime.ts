import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

let active: PDFDocumentProxy | null = null;

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  active?.destroy();
  active = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  return active;
}

export const activePdf = () => active;
export { pdfjs };
