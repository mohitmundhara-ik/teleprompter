export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

/**
 * Stable identity for an imported file: SHA-256 of its bytes (first 8 MB) plus
 * size. Reopening the same deck restores the notes attached to it.
 */
async function toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Response(blob).arrayBuffer();
}

export async function hashFile(file: File | Blob, name = ''): Promise<string> {
  const slice = file.slice(0, 8 * 1024 * 1024);
  const buf = await toArrayBuffer(slice);
  let digest = '';
  try {
    const h = await crypto.subtle.digest('SHA-256', buf);
    digest = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    const bytes = new Uint8Array(buf);
    let h = 2166136261;
    for (let i = 0; i < bytes.length; i += 997) h = ((h ^ bytes[i]) * 16777619) >>> 0;
    digest = h.toString(16);
  }
  return `${digest}-${file.size}-${(name || (file as File).name || '').length}`;
}

export const noteKey = (sessionId: string, pageIndex: number) => `${sessionId}:${pageIndex}`;
