import { useCallback, useEffect, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas, type ZoomMode } from './components/Canvas';
import { NotesPanel } from './components/NotesPanel';
import { DropZone } from './components/DropZone';
import { Sessions } from './components/Sessions';
import { Settings } from './components/Settings';
import { Toasts } from './components/Toasts';
import { ProgressOverlay } from './components/ProgressOverlay';
import { PresentBar } from './components/PresentBar';
import { Button } from './components/ui';
import { flushPendingSave, useStore } from './state/store';
import { ACCEPT, importFiles } from './adapters';
import { getFile, getSession, putFile, putSession } from './db/db';
import { adoptNotesFromHash } from './lib/transfer';
import { hashFile, uid } from './lib/id';
import { converterUrl } from './lib/converter';
import { openPrompter, prompterUrl } from './lib/popout';
import { HINT_KEY, LAST_SESSION_KEY, PRESENT_TIP_KEY, applyTheme, safeGet, safeSet } from './lib/prefs';
import { isTyping } from './lib/shortcuts';
import { useTripleClick } from './lib/tripleClick';
import type { LoadedDocument, SessionRecord } from './types';

export default function App() {
  const store = useStore();
  const { init, attachDoc, step, setNote, toast, theme } = store;
  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [hint, setHint] = useState(() => safeGet(HINT_KEY) !== '1');
  const [sharing, setSharing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [presentTip, setPresentTip] = useState(() => safeGet(PRESENT_TIP_KEY) !== '1');
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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
          toast(`Recovered ${session.title} with your notes.`);
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

  /* ---- presenting: hide everything, reveal controls only on movement ---- */
  useEffect(() => {
    if (!presenting) {
      setChrome(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setChrome(true);
      clearTimeout(timer);
      timer = setTimeout(() => setChrome(false), 2000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
    };
  }, [presenting]);

  /* ---- importing ---- */
  const handleFiles = useCallback(
    async (files: File[]) => {
      const first = files[0];
      if (!first) return;
      const isPptx = /\.pptx?$/i.test(first.name);
      let allowConversion = false;
      if (isPptx && converterUrl()) {
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
    setZoom('fit');

    try {
      await putSession(session);
      await putFile({ sessionId: id, blob: file, name: file.name, type: file.type });
      const adopted = await adoptNotesFromHash(id, docHash, id);
      if (adopted) {
        await useStore.getState().reloadTexts();
        toast('Notes from the last time you opened this file were restored.');
      }
      if (notes?.size) {
        for (const [i, text] of notes) setNote(i, text);
        await flushPendingSave();
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'This file is open, but it could not be saved for next time.',
        'error',
      );
    }
  };

  /* ---- screen share ---- */
  const toggleShare = async () => {
    const w = window as unknown as { __pdScreenStream?: MediaStream };
    if (sharing) {
      w.__pdScreenStream?.getTracks().forEach((t) => t.stop());
      w.__pdScreenStream = undefined;
      setSharing(false);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('This browser cannot share a screen. Chrome or Edge on desktop is required.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      w.__pdScreenStream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        w.__pdScreenStream = undefined;
        setSharing(false);
        toast('Screen sharing ended.');
      });
      setSharing(true);
      const session: SessionRecord = {
        id: useStore.getState().sessionId ?? uid('s'),
        title: 'Screen share',
        fileName: '',
        mimeType: '',
        kind: 'screen',
        docHash: 'screen',
        pageCount: 1,
        pageTitles: ['Shared screen'],
        currentIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await putSession(session);
      attachDoc(
        {
          kind: 'screen',
          title: 'Screen share',
          pages: [{ index: 0, title: 'Shared screen', render: { type: 'screen' } }],
          notices: [],
        },
        session,
      );
      toast('Share the PromptDeck window or another window. Do not pick the teleprompter window if you want it private.');
    } catch (err) {
      const name = (err as { name?: string }).name;
      toast(
        name === 'NotAllowedError'
          ? 'Screen sharing was cancelled or blocked in your browser permissions.'
          : 'Screen sharing could not start.',
        name === 'NotAllowedError' ? 'warn' : 'error',
      );
    }
  };

  /* ---- teleprompter popout ---- */
  const openTeleprompter = useCallback(() => {
    const sid = useStore.getState().sessionId;
    if (!sid) return;
    const { ok } = openPrompter(sid);
    setPopupBlocked(!ok);
    if (!ok) toast('Your browser blocked the teleprompter window. Allow pop-ups for this site, then try again.', 'warn');
    if (hint) dismissHint();
  }, [hint, toast]);  

  const dismissHint = () => {
    setHint(false);
    safeSet(HINT_KEY, '1');
  };

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
        case 'p':
        case 'P':
          setPresenting((v) => !v);
          break;
        case 'Escape':
          setPresenting(false);
          break;
        case 'f':
        case 'F':
          void stageRef.current?.requestFullscreen?.().catch(() => undefined);
          break;
        case 'd':
        case 'D': {
          const s = useStore.getState();
          s.setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, openTeleprompter]);

  const tripleClick = useTripleClick(openTeleprompter);
  const doc = store.doc;
  const page = doc?.pages[store.index] ?? null;

  if (presenting) {
    return (
      <div
        {...tripleClick}
        data-testid="stage"
        className="fixed inset-0 z-10 flex flex-col bg-black"
        style={{ cursor: chrome ? 'default' : 'none' }}
      >
        {doc ? (
          <Canvas page={page} zoom="fit" bare />
        ) : (
          <p className="m-auto max-w-[46ch] text-center text-[14px] text-[var(--ink-2)]">
            Nothing is loaded yet. Press Escape to go back and add a file.
          </p>
        )}
        <PresentBar
          visible={chrome}
          tip={presentTip}
          onDismissTip={() => {
            setPresentTip(false);
            safeSet(PRESENT_TIP_KEY, '1');
          }}
          index={store.index}
          count={doc?.pages.length ?? 0}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onPrompter={openTeleprompter}
          onExit={() => setPresenting(false)}
        />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        onNew={() => {
          const id = uid('s');
          safeSet(LAST_SESSION_KEY, id);
          location.href = `${location.pathname}?session=${id}`;
        }}
        onUpload={() => fileInput.current?.click()}
        onScreenShare={() => void toggleShare()}
        onPrompter={openTeleprompter}
        onFullscreen={() => void stageRef.current?.requestFullscreen?.().catch(() => undefined)}
        onSettings={() => setShowSettings(true)}
        onSessions={() => setShowSessions(true)}
        onPresent={() => setPresenting(true)}
        sharing={sharing}
        zoom={zoom}
        setZoom={setZoom}
      />

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

      {popupBlocked ? (
        <div className="flex items-center gap-3 border-b border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3 py-2 text-[13px]">
          <span className="flex-1">
            The teleprompter window was blocked. Allow pop-ups for this site in the address bar, then open it again.
          </span>
          <Button size="sm" onClick={openTeleprompter}>Open teleprompter</Button>
          <a className="text-[var(--accent)] underline" href={prompterUrl(store.sessionId ?? '')} target="_blank" rel="noreferrer">
            Open in a tab instead
          </a>
          <Button size="sm" variant="ghost" onClick={() => setPopupBlocked(false)}>Dismiss</Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div
          ref={stageRef}
          {...tripleClick}
          data-testid="stage"
          className="relative flex min-w-0 flex-1 flex-col bg-[var(--bg)]"
        >
          {doc ? (
            <Canvas page={page} zoom={zoom} />
          ) : (
            <DropZone onFiles={(f) => void handleFiles(f)} onShare={() => void toggleShare()} />
          )}

          {hint ? (
            <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-[12.5px] shadow-[var(--shadow)]">
              Triple-click the presentation to open the teleprompter.
              <button onClick={dismissHint} className="text-[var(--ink-3)] hover:text-[var(--ink)]" aria-label="Dismiss hint">
                Got it
              </button>
            </div>
          ) : null}

          {store.session?.kind === 'screen' ? (
            <p className="border-t border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--ink-2)]">
              Screen sharing shows another application. A web page cannot advance slides inside PowerPoint or Keynote, so
              page controls are inactive. Load the deck into PromptDeck to control it from the teleprompter.
            </p>
          ) : null}

          {progress ? <ProgressOverlay pct={progress.pct} label={progress.label} /> : null}
        </div>

        {notesOpen ? (
          <aside className="flex w-[380px] shrink-0 flex-col gap-2 border-l border-[var(--line)] bg-[var(--bg)] p-2">
            <NotesPanel />
            <Button size="sm" variant="ghost" onClick={() => setNotesOpen(false)}>Hide notes panel</Button>
          </aside>
        ) : (
          <button
            onClick={() => setNotesOpen(true)}
            className="w-8 shrink-0 border-l border-[var(--line)] bg-[var(--surface)] text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)]"
            style={{ writingMode: 'vertical-rl' }}
          >
            Notes
          </button>
        )}
      </div>

      {showSessions ? (
        <Sessions
          onClose={() => setShowSessions(false)}
          onOpen={(id) => {
            safeSet(LAST_SESSION_KEY, id);
            location.href = `${location.pathname}?session=${id}`;
          }}
        />
      ) : null}
      {showSettings ? (
        <Settings
          onClose={() => setShowSettings(false)}
          onWiped={() => {
            setShowSettings(false);
            location.href = location.pathname;
          }}
        />
      ) : null}
      <Toasts />
    </div>
  );
}
