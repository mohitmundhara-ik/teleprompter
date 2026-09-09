import Dexie, { type Table } from 'dexie';
import type { DisplaySettings, FileRecord, NoteRecord, ScriptRecord, SessionRecord } from '../types';
import { noteKey } from '../lib/id';
import { DEFAULT_DISPLAY } from '../lib/prefs';
import { displaySettingsSchema } from './schema';

class PromptDeckDB extends Dexie {
  sessions!: Table<SessionRecord, string>;
  files!: Table<FileRecord, string>;
  scripts!: Table<ScriptRecord, string>;
  notes!: Table<NoteRecord, string>;
  prefs!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('promptdeck');
    // Version 1 is the shipped schema. Add versions below; never recreate the
    // database, so upgrades keep the presenter's scripts.
    this.version(1).stores({
      sessions: 'id, docHash, updatedAt',
      files: 'sessionId',
      scripts: 'sessionId',
      notes: 'key, sessionId, [sessionId+pageIndex]',
      prefs: 'key',
    });
  }
}

export const db = new PromptDeckDB();

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

function wrap(err: unknown): never {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'QuotaExceededError' || name === 'AbortError') {
    throw new QuotaError('Local storage is full. Delete an old session to free space.');
  }
  throw err;
}

export async function putSession(s: SessionRecord) {
  try {
    await db.sessions.put({ ...s, updatedAt: Date.now() });
  } catch (e) {
    wrap(e);
  }
}

export async function putFile(rec: FileRecord) {
  try {
    await db.files.put(rec);
  } catch (e) {
    wrap(e);
  }
}

export const getFile = (sessionId: string) => db.files.get(sessionId);
export const getSession = (id: string) => db.sessions.get(id);
export const listSessions = () => db.sessions.orderBy('updatedAt').reverse().toArray();
export const findSessionByHash = (docHash: string) => db.sessions.where('docHash').equals(docHash).first();

export async function saveScript(sessionId: string, text: string, rev: number) {
  try {
    await db.scripts.put({ sessionId, text, rev, updatedAt: Date.now() });
  } catch (e) {
    wrap(e);
  }
}

export const getScript = (sessionId: string) => db.scripts.get(sessionId);

export async function saveNote(sessionId: string, pageIndex: number, text: string, rev: number) {
  try {
    await db.notes.put({ key: noteKey(sessionId, pageIndex), sessionId, pageIndex, text, rev, updatedAt: Date.now() });
  } catch (e) {
    wrap(e);
  }
}

export const getNotes = (sessionId: string) => db.notes.where('sessionId').equals(sessionId).toArray();

export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.files, db.scripts, db.notes, async () => {
    await db.sessions.delete(id);
    await db.files.delete(id);
    await db.scripts.delete(id);
    await db.notes.where('sessionId').equals(id).delete();
  });
}

export async function deleteAll() {
  await db.transaction('rw', db.sessions, db.files, db.scripts, db.notes, db.prefs, async () => {
    await Promise.all([db.sessions.clear(), db.files.clear(), db.scripts.clear(), db.notes.clear(), db.prefs.clear()]);
  });
}

const DISPLAY_KEY = 'display';

export async function loadDisplay(): Promise<DisplaySettings> {
  const row = await db.prefs.get(DISPLAY_KEY);
  const parsed = displaySettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_DISPLAY;
}

export async function saveDisplay(value: DisplaySettings) {
  try {
    await db.prefs.put({ key: DISPLAY_KEY, value });
  } catch (e) {
    wrap(e);
  }
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
