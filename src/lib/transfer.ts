import { db, getNotes, getScript, loadDisplay, putSession, saveNote, saveScript } from '../db/db';
import { exportSchema, type SessionExport } from '../db/schema';
import type { SessionRecord } from '../types';

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportSession(session: SessionRecord, format: 'txt' | 'md' | 'json') {
  const [script, notes, display] = await Promise.all([getScript(session.id), getNotes(session.id), loadDisplay()]);
  const safeTitle = session.title.replace(/[^\w\- ]+/g, '').trim() || 'session';

  if (format === 'json') {
    const payload: SessionExport = {
      format: 'promptdeck.session',
      version: 1,
      exportedAt: Date.now(),
      session,
      script: script ?? null,
      notes: notes.sort((a, b) => a.pageIndex - b.pageIndex),
      display,
    };
    download(`${safeTitle}.promptdeck.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    return;
  }

  const lines: string[] = [`# ${session.title}`, ''];
  if (script?.text) lines.push('## Full script', '', script.text, '');
  for (const n of notes.sort((a, b) => a.pageIndex - b.pageIndex)) {
    if (!n.text.trim()) continue;
    lines.push(`--- Slide ${n.pageIndex + 1} ---`, '', n.text, '');
  }
  download(`${safeTitle}.${format}`, new Blob([lines.join('\n')], { type: 'text/plain' }));
}

/** Restores a .promptdeck.json backup. Returns the number of note pages read. */
export async function importSessionJson(file: File): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const result = exportSchema.safeParse(parsed);
  if (!result.success) throw new Error('That JSON is not a PromptDeck session export.');
  const { session, script, notes } = result.data;
  await putSession(session);
  if (script) await saveScript(session.id, script.text, script.rev);
  for (const n of notes) await saveNote(session.id, n.pageIndex, n.text, n.rev);
  return notes.length;
}

/** Reattach notes from a previous session that used the same file. */
export async function adoptNotesFromHash(newSessionId: string, docHash: string, exceptId: string) {
  const prior = await db.sessions.where('docHash').equals(docHash).toArray();
  const source = prior.find((s) => s.id !== exceptId);
  if (!source) return false;
  const [notes, script] = await Promise.all([getNotes(source.id), getScript(source.id)]);
  for (const n of notes) await saveNote(newSessionId, n.pageIndex, n.text, n.rev);
  if (script) await saveScript(newSessionId, script.text, script.rev);
  return notes.length > 0 || Boolean(script?.text);
}
