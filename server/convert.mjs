/**
 * Optional first-party PPTX/DOC converter for PromptDeck.
 *
 * PromptDeck never contacts this service unless you set its address in
 * Settings and confirm the upload for each file. Run it on your own machine or
 * inside your own network. It shells out to LibreOffice, writes to a temporary
 * directory, and deletes both the input and the output once the response is
 * sent. Nothing is stored and nothing leaves the host it runs on.
 *
 *   node server/convert.mjs            # listens on http://localhost:8787
 *   PORT=9000 ORIGIN=https://deck.internal node server/convert.mjs
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const PORT = Number(process.env.PORT ?? 8787);
const ORIGIN = process.env.ORIGIN ?? '*';
const MAX_BYTES = 256 * 1024 * 1024;
const SOFFICE = process.env.SOFFICE_BIN ?? 'soffice';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Minimal multipart/form-data reader: one file field, no dependencies. */
function extractFile(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  if (!boundary) throw new Error('missing boundary');
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = buffer.indexOf(marker);
  while (start !== -1) {
    const headerEnd = buffer.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;
    const headers = buffer.subarray(start, headerEnd).toString('latin1');
    const next = buffer.indexOf(marker, headerEnd);
    if (/filename="/i.test(headers)) {
      const name = /filename="([^"]*)"/i.exec(headers)?.[1] ?? 'input.pptx';
      const body = buffer.subarray(headerEnd + 4, next === -1 ? buffer.length : next - 2);
      return { name, body };
    }
    start = next;
  }
  throw new Error('no file part');
}

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method === 'GET' && req.url === '/health') {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  }
  if (req.method !== 'POST' || !req.url?.startsWith('/convert')) {
    return res.writeHead(404).end('Not found');
  }

  let dir;
  try {
    const raw = await readBody(req);
    const { name, body } = extractFile(raw, req.headers['content-type']);
    if (!/\.(pptx?|docx?|odp|odt)$/i.test(name)) throw new Error('unsupported extension');

    dir = await mkdtemp(join(tmpdir(), 'promptdeck-'));
    const input = join(dir, name.replace(/[^\w.-]+/g, '_'));
    await writeFile(input, body);
    await run(SOFFICE, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, input], {
      timeout: 180_000,
    });
    const pdf = await readFile(input.replace(/\.[^.]+$/, '.pdf'));
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length }).end(pdf);
    console.log(`converted ${name} -> ${pdf.length} bytes`);
  } catch (err) {
    console.error('conversion failed:', err.message);
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Conversion failed: ${err.message}`);
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

server.listen(PORT, () => {
  console.log(`PromptDeck converter on http://localhost:${PORT}  (LibreOffice: ${SOFFICE})`);
});
