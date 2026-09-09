import { create } from 'zustand';
import type { DisplaySettings, LoadedDocument, SaveState, SessionRecord, ThemeMode } from '../types';
import { Bus } from '../sync/bus';
import type { Payload, Role } from '../sync/protocol';
import {
  getNotes,
  getScript,
  getSession,
  loadDisplay,
  putSession,
  saveDisplay,
  saveNote,
  saveScript,
  QuotaError,
} from '../db/db';
import { DEFAULT_DISPLAY, LAST_SESSION_KEY, applyTheme, readTheme, safeSet, THEME_KEY } from '../lib/prefs';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'warn';
}

export interface DeckMeta {
  title: string;
  pageCount: number;
  pageTitles: string[];
  kind: string;
}

interface State {
  role: Role;
  bus: Bus | null;
  sessionId: string | null;
  session: SessionRecord | null;
  /** Deck shape as known to this window. Filled from storage, then kept in
      step with the other window by 'meta' frames, so the popout works even
      when it opens before the document finishes loading. */
  meta: DeckMeta;
  doc: LoadedDocument | null;
  index: number;
  script: string;
  scriptRev: number;
  notes: Record<number, string>;
  noteRevs: Record<number, number>;
  display: DisplaySettings;
  theme: ThemeMode;
  save: SaveState;
  connected: boolean;
  peerEverSeen: boolean;
  dirty: boolean;
  toasts: Toast[];
  mediaController: { play(): void; pause(): void; seek(d: number): void; rate(r: number): void } | null;

  init(role: Role, sessionId: string): Promise<void>;
  attachDoc(doc: LoadedDocument, session: SessionRecord): void;
  goto(index: number, broadcast?: boolean): void;
  step(delta: number): void;
  setScript(text: string): void;
  setNote(index: number, text: string): void;
  setDisplay(patch: Partial<DisplaySettings>): void;
  setTheme(mode: ThemeMode): void;
  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  setMediaController(c: State['mediaController']): void;
  sendMedia(action: 'play' | 'pause' | 'seek' | 'rate', value?: number): void;
  reloadTexts(): Promise<void>;
  teardown(): void;
}

let toastSeq = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** One pending write per target, so a burst of edits does not drop any of them. */
const pendingWrites = new Map<string, () => Promise<void>>();

export const useStore = create<State>((set, get) => ({
  role: 'main',
  bus: null,
  sessionId: null,
  session: null,
  meta: { title: 'PromptDeck', pageCount: 0, pageTitles: [], kind: 'none' },
  doc: null,
  index: 0,
  script: '',
  scriptRev: 0,
  notes: {},
  noteRevs: {},
  display: DEFAULT_DISPLAY,
  theme: readTheme(),
  save: 'idle',
  connected: false,
  peerEverSeen: false,
  dirty: false,
  toasts: [],
  mediaController: null,

  async init(role, sessionId) {
    get().bus?.close();
    const bus = new Bus(sessionId, role);
    const [session, script, notes, display] = await Promise.all([
      getSession(sessionId),
      getScript(sessionId),
      getNotes(sessionId),
      loadDisplay(),
    ]);

    const noteMap: Record<number, string> = {};
    const revMap: Record<number, number> = {};
    for (const n of notes) {
      noteMap[n.pageIndex] = n.text;
      revMap[n.pageIndex] = n.rev;
    }

    set({
      role,
      bus,
      sessionId,
      session: session ?? null,
      meta: session
        ? { title: session.title, pageCount: session.pageCount, pageTitles: session.pageTitles ?? [], kind: session.kind }
        : { title: 'PromptDeck', pageCount: 0, pageTitles: [], kind: 'none' },
      index: session?.currentIndex ?? 0,
      script: script?.text ?? '',
      scriptRev: script?.rev ?? 0,
      notes: noteMap,
      noteRevs: revMap,
      display,
    });
    safeSet(LAST_SESSION_KEY, sessionId);

    bus.on((p) => applyRemote(p, set, get));
    bus.onPresence((connected) => {
      set((s) => ({ connected, peerEverSeen: s.peerEverSeen || connected }));
      // Reconnect after either window reloaded: pull the current state again.
      if (connected && get().role === 'prompter') bus.post({ t: 'state-request' });
    });

    if (role === 'prompter') bus.post({ t: 'state-request' });
    applyTheme(get().theme);
  },

  attachDoc(doc, session) {
    // A popout may already have navigated while the document was loading, so
    // keep that position rather than snapping back to the stored one.
    const desired = get().index || session.currentIndex;
    set({
      doc,
      session,
      meta: { title: session.title, pageCount: doc.pages.length, pageTitles: doc.pages.map((p) => p.title), kind: doc.kind },
      index: Math.min(desired, Math.max(0, doc.pages.length - 1)),
    });
    get().bus?.post({
      t: 'meta',
      title: session.title,
      pageCount: doc.pages.length,
      kind: doc.kind,
      pageTitles: doc.pages.map((p) => p.title),
    });
    get().bus?.post({ t: 'nav', index: get().index });
  },

  goto(index, broadcast = true) {
    const { session, doc, meta } = get();
    // A popout that opened before the deck finished loading does not know the
    // page count yet. Move optimistically and let the main window clamp.
    const known = doc?.pages.length || meta.pageCount || session?.pageCount || 0;
    const next = known ? Math.max(0, Math.min(index, known - 1)) : Math.max(0, index);
    if (next === get().index) return;
    set({ index: next });
    if (broadcast) get().bus?.post({ t: 'nav', index: next });
    if (session) void putSession({ ...session, currentIndex: next });
  },

  step(delta) {
    get().goto(get().index + delta);
  },

  setScript(text) {
    const rev = get().scriptRev + 1;
    set({ script: text, scriptRev: rev, dirty: true });
    get().bus?.post({ t: 'script', text, rev });
    persist(set, get, 'script', async (sid) => saveScript(sid, text, rev));
  },

  setNote(index, text) {
    const rev = (get().noteRevs[index] ?? 0) + 1;
    set((s) => ({
      notes: { ...s.notes, [index]: text },
      noteRevs: { ...s.noteRevs, [index]: rev },
      dirty: true,
    }));
    get().bus?.post({ t: 'note', index, text, rev });
    persist(set, get, `note:${index}`, async (sid) => saveNote(sid, index, text, rev));
  },

  setDisplay(patch) {
    const value = { ...get().display, ...patch };
    set({ display: value });
    get().bus?.post({ t: 'display', value });
    void saveDisplay(value);
  },

  setTheme(mode) {
    set({ theme: mode });
    safeSet(THEME_KEY, mode);
    applyTheme(mode);
  },

  toast(text, tone = 'info') {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 9000 : 5000);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setMediaController(c) {
    set({ mediaController: c });
  },

  /** Control media playing in the main window, from either window. */
  sendMedia(action, value) {
    const { bus, mediaController } = get();
    bus?.post({ t: 'media', action, value });
    if (!mediaController) return;
    if (action === 'play') mediaController.play();
    else if (action === 'pause') mediaController.pause();
    else if (action === 'seek') mediaController.seek(value ?? 0);
    else if (action === 'rate') mediaController.rate(value ?? 1);
  },

  /** Re-read script and notes from storage without disturbing the open document. */
  async reloadTexts() {
    const sid = get().sessionId;
    if (!sid) return;
    const [script, notes] = await Promise.all([getScript(sid), getNotes(sid)]);
    const noteMap: Record<number, string> = {};
    const revMap: Record<number, number> = {};
    for (const n of notes) {
      noteMap[n.pageIndex] = n.text;
      revMap[n.pageIndex] = n.rev;
    }
    set({ script: script?.text ?? '', scriptRev: script?.rev ?? 0, notes: noteMap, noteRevs: revMap });
    const bus = get().bus;
    if (bus) {
      bus.post({ t: 'script', text: script?.text ?? '', rev: script?.rev ?? 0 });
      for (const [i, text] of Object.entries(noteMap)) bus.post({ t: 'note', index: Number(i), text, rev: revMap[Number(i)] ?? 1 });
    }
  },

  teardown() {
    get().bus?.close();
    set({ bus: null });
  },
}));

/** Debounced write-behind so typing never blocks on IndexedDB. */
function persist(
  set: (partial: Partial<State>) => void,
  get: () => State,
  key: string,
  write: (sessionId: string) => Promise<void>,
) {
  const sid = get().sessionId;
  if (!sid) return;
  set({ save: 'saving' });
  pendingWrites.set(key, async () => {
    try {
      await write(sid);
    } catch (err) {
      set({ save: 'error' });
      get().toast(
        err instanceof QuotaError ? err.message : 'Autosave failed. Your text is still on screen: export it from the notes panel.',
        'error',
      );
      throw err;
    }
  });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void runPendingWrites(set), 400);
}

async function runPendingWrites(set: (partial: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const jobs = [...pendingWrites.values()];
  pendingWrites.clear();
  if (!jobs.length) return;
  const results = await Promise.allSettled(jobs.map((j) => j()));
  if (results.every((r) => r.status === 'fulfilled')) set({ save: 'saved', dirty: false });
}

/**
 * Write every debounced edit immediately: when a window is closing, and after
 * a bulk change such as mapping a whole talk track onto its pages.
 */
export function flushPendingSave(): Promise<void> {
  return runPendingWrites((partial) => useStore.setState(partial));
}

function applyRemote(p: Payload, set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void, get: () => State) {
  switch (p.t) {
    case 'nav':
      if (p.index !== get().index) get().goto(p.index, false);
      break;
    case 'meta':
      set((s) => ({
        meta: { title: p.title, pageCount: p.pageCount, pageTitles: p.pageTitles, kind: p.kind },
        session: s.session
          ? { ...s.session, title: p.title, pageCount: p.pageCount, pageTitles: p.pageTitles }
          : s.session,
      }));
      break;
    case 'script': {
      if (p.rev <= get().scriptRev) break;
      if (get().dirty && get().script !== p.text) {
        get().toast('The other window saved a newer script. Its version is now shown.', 'warn');
      }
      set({ script: p.text, scriptRev: p.rev });
      // Store it here too, so the text survives even if the window that typed
      // it closes before its own debounced save runs.
      const sid = get().sessionId;
      if (sid) void saveScript(sid, p.text, p.rev);
      break;
    }
    case 'note': {
      if (p.rev <= (get().noteRevs[p.index] ?? 0)) break;
      set((s) => ({ notes: { ...s.notes, [p.index]: p.text }, noteRevs: { ...s.noteRevs, [p.index]: p.rev } }));
      const sid = get().sessionId;
      if (sid) void saveNote(sid, p.index, p.text, p.rev);
      break;
    }
    case 'display':
      set({ display: p.value as DisplaySettings });
      break;
    case 'media': {
      const c = get().mediaController;
      if (!c) break;
      if (p.action === 'play') c.play();
      else if (p.action === 'pause') c.pause();
      else if (p.action === 'seek') c.seek(p.value ?? 0);
      else if (p.action === 'rate') c.rate(p.value ?? 1);
      break;
    }
    case 'state-request': {
      const s = get();
      if (s.role !== 'main') break;
      s.bus?.post({ t: 'nav', index: s.index });
      s.bus?.post({ t: 'script', text: s.script, rev: s.scriptRev });
      if (s.session && s.doc) {
        s.bus?.post({
          t: 'meta',
          title: s.session.title,
          pageCount: s.doc.pages.length,
          kind: s.doc.kind,
          pageTitles: s.doc.pages.map((x) => x.title),
        });
      }
      for (const [i, text] of Object.entries(s.notes)) {
        s.bus?.post({ t: 'note', index: Number(i), text, rev: s.noteRevs[Number(i)] ?? 1 });
      }
      break;
    }
    default:
      break;
  }
}
