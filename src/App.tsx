import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Sessions, Modal } from './components/Sessions';
import { Settings } from './components/Settings';
import { Toasts } from './components/Toasts';
import { ProgressOverlay } from './components/ProgressOverlay';
import { useStore } from './state/store';
import { ACCEPT, importFiles } from './adapters';
import { getFile, getSession, putFile, putSession } from './db/db';
import { adoptNotesFromHash } from './lib/transfer';
import { flushPendingSave } from './state/store';
import { hashFile, uid } from './lib/id';
import { converterUrl } from './lib/converter';
import { openPrompter, prompterUrl } from './lib/popout';
import { LAST_SESSION_KEY, applyTheme, safeGet, safeSet } from './lib/prefs';
import { SHORTCUTS, isTyping } from './lib/shortcuts';
import { useTripleClick } from './lib/tripleClick';
import type { LoadedDocument, SessionRecord } from './types';

/**
 * The presenter's screen. It draws the slide and nothing else, because this is
 * the window that gets shared. Every control lives either on the keyboard or in
 * the teleprompter window, which a shared tab never includes.
 */
export default function App() {
  const store = useStore();
  const { init, attachDoc, step, setNote, toast, theme } = store;
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [panel, setPanel] = useState<'none' | 'sessions' | 'settings' | 'keys'>('none');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bootRef = useRef(false);

  /* ---- session boot and crash recovery ---- */
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const url = new URL(location.href);
    const wanted = url.searchParams.get('session') ?? safeGet(LAST_SESSION_KEY) ?? uid('s');
    void (async () => {
      await init('main', wanted);
      const session = await getSession(wanted);
      const stored = await getFile(wanted);
      if (session && stored) {
        try {
          setProgress({ pct: 5, label: `Reopening ${session.fileName}` });
          const file = new File([stored.blob], stored.name, { type: stored.type });
          const { doc } = await importFiles([file], {
            allowConversion: false,
            onProgress: (pct, label) => setProgress({ pct, label }),
          });
          attachDoc(doc, session);
        } catch {
          toast('The previous file could not be reopened, but your notes are safe.', 'warn');
        } finally {
          setProgress(null);
        }
      }
    })();
    return () => useStore.getState().teardown();
  }, [init, attachDoc, toast]);

  useEffect(() => applyTheme(theme), [theme]);

  /* ---- importing ---- */
  const handleFiles = useCallback(
    async (files: File[]) => {
      const first = files[0];
      if (!first) return;
      let allowConversion = false;
      if (/\.pptx?$/i.test(first.name) && converterUrl()) {
        allowConversion = window.confirm(
          `Send "${first.name}" to your converter service for exact slide rendering?\n\nChoose Cancel to keep the file on this machine and import slide text only.`,
        );
      }
      setProgress({ pct: 2, label: `Reading ${first.name}` });
      try {
        const { doc, notes } = await importFiles(files, {
          allowConversion,
          onProgress: (pct, label) => setProgress({ pct, label }),
        });
        await openDocument(doc, first, notes);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'That file could not be loaded.', 'error');
      } finally {
        setProgress(null);
      }
    },
    [toast], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openDocument = async (doc: LoadedDocument, file: File, notes?: Map<number, string>) => {
    const docHash = await hashFile(file, file.name);
    const id = useStore.getState().sessionId ?? uid('s');
    const session: SessionRecord = {
      id,
      title: doc.title || file.name,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      kind: doc.kind,
      docHash,
      pageCount: doc.pages.length,
      pageTitles: doc.pages.map((p) => p.title),
      currentIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Show the deck first: nothing about saving should delay the presenter.
    attachDoc(doc, session);
    for (const n of doc.notices) toast(n, 'warn');

    try {
      await putSession(session);
      await putFile({ sessionId: id, blob: file, name: file.name, type: file.type });
      if (await adoptNotesFromHash(id, docHash, id)) {
        await useStore.getState().reloadTexts();
        toast('Notes from the last time you opened this file were restored.');
      }
      if (notes?.size) {
        for (const [i, text] of notes) setNote(i, text);
        await flushPendingSave();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'This file is open, but it could not be saved for next time.', 'error');
    }
  };

  /* ---- drag and drop anywhere ---- */
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const leave = () => {
      if (--depth <= 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) void handleFiles([...e.dataTransfer.files]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [handleFiles]);

  /* ---- teleprompter popout ---- */
  const openTeleprompter = useCallback(() => {
    const sid = useStore.getState().sessionId;
    if (!sid) return;
    const { ok } = openPrompter(sid);
    setPopupBlocked(!ok);
  }, []);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  /* ---- keyboard: the only chrome this window has ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          step(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          step(-1);
          break;
        case 't':
        case 'T':
          openTeleprompter();
          break;
        case 'o':
        case 'O':
          fileInput.current?.click();
          break;
        case 'n':
        case 'N': {
          const id = uid('s');
          safeSet(LAST_SESSION_KEY, id);
          location.href = `${location.pathname}?session=${id}`;
          break;
        }
        case 's':
        case 'S':
          setPanel((p) => (p === 'sessions' ? 'none' : 'sessions'));
          break;
        case ',':
          setPanel((p) => (p === 'settings' ? 'none' : 'settings'));
          break;
        case 'f':
        case 'F':
          fullscreen();
          break;
        case 'd':
        case 'D':
          useStore.getState().setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
          break;
        case '?':
          setPanel((p) => (p === 'keys' ? 'none' : 'keys'));
          break;
        case 'Escape':
          setPanel('none');
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, openTeleprompter, fullscreen]);

  const tripleClick = useTripleClick(openTeleprompter);
  const doc = store.doc;
  const page = doc?.pages[store.index] ?? null;

  return (
    <div {...tripleClick} data-testid="stage" className="relative flex h-full w-full flex-col bg-black">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles([...e.target.files]);
          e.target.value = '';
        }}
      />

      {doc ? (
        <Canvas page={page} zoom="fit" bare />
      ) : (
        <div className="m-auto max-w-[46ch] px-6 text-center text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          <p className="mb-4">
            Drop a deck anywhere in this window. Triple-click to open the teleprompter, which holds the script and the
            controls. Press ? for the keys.
          </p>
          <button
            data-no-triple
            onClick={() => fileInput.current?.click()}
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--ink)]"
          >
            Choose a file
          </button>
        </div>
      )}

      {dragging ? (
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed border-[var(--accent)]" aria-hidden />
      ) : null}

      {popupBlocked ? (
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-[var(--warn)] px-3 py-2 text-[13px] text-black">
          <span className="flex-1">The teleprompter window was blocked. Allow pop-ups for this site, then triple-click again.</span>
          <a className="underline" href={prompterUrl(store.sessionId ?? '')} target="_blank" rel="noreferrer" data-no-triple>
            Open in a tab
          </a>
          <button data-no-triple onClick={() => setPopupBlocked(false)}>Dismiss</button>
        </div>
      ) : null}

      {progress ? <ProgressOverlay pct={progress.pct} label={progress.label} /> : null}

      {panel === 'sessions' ? (
        <Sessions
          onClose={() => setPanel('none')}
          onOpen={(id) => {
            safeSet(LAST_SESSION_KEY, id);
            location.href = `${location.pathname}?session=${id}`;
          }}
        />
      ) : null}
      {panel === 'settings' ? (
        <Settings
          onClose={() => setPanel('none')}
          onWiped={() => {
            setPanel('none');
            location.href = location.pathname;
          }}
        />
      ) : null}
      {panel === 'keys' ? (
        <Modal title="Keys" onClose={() => setPanel('none')}>
          <table className="w-full p-4 text-left text-[13px]">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td className="w-[210px] px-4 py-1 font-mono text-[12px] text-[var(--ink-2)]">{s.keys}</td>
                  <td className="px-2 py-1">{s.what}</td>
                  <td className="px-4 py-1 text-[12px] text-[var(--ink-3)]">{s.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      ) : null}
      <Toasts />
    </div>
  );
}
