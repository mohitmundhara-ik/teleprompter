import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { flushPendingSave } from '../state/store';
import { hasSlideMarkers, splitScriptByMarkers } from '../lib/format';
import { exportSession, importSessionJson } from '../lib/transfer';

/**
 * Script housekeeping lives here, in the teleprompter, because the main window
 * shows the slide and nothing else.
 */
export function ScriptTools({ onDone }: { onDone(): void }) {
  const { session, script, setNote, toast } = useStore((s) => s);
  const [confirmClear, setConfirmClear] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const split = async (text: string, label: string) => {
    const map = splitScriptByMarkers(text);
    if (!map.size) {
      toast('No slide numbers found. Label sections "Slide 2" and try again.', 'warn');
      return;
    }
    for (const [i, body] of map) setNote(i, body);
    await flushPendingSave();
    toast(`${label} mapped onto ${map.size} pages.`);
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: 'rgb(128 128 128 / 0.3)' }}>
      <input
        ref={file}
        type="file"
        accept=".txt,.md,.markdown,.json"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            if (f.name.endsWith('.json')) {
              const n = await importSessionJson(f);
              toast(`Imported ${n} pages of notes. Reopen the session to see them.`);
              return;
            }
            const text = await f.text();
            useStore.getState().setScript(text);
            if (hasSlideMarkers(text)) await split(text, 'Script imported and');
            else toast('Script imported. Label sections "Slide 2" to map them onto pages.');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That file could not be read.', 'error');
          }
        }}
      />
      <Tool onClick={() => file.current?.click()}>Import script</Tool>
      <Tool onClick={() => void split(script, 'Script')}>Map to pages</Tool>
      <Tool onClick={() => session && void exportSession(session, 'txt')}>Export .txt</Tool>
      <Tool onClick={() => session && void exportSession(session, 'json')}>Export .json</Tool>
      {confirmClear ? (
        <>
          <span className="text-[11px] opacity-70">Clear this page?</span>
          <Tool
            onClick={() => {
              setNote(useStore.getState().index, '');
              setConfirmClear(false);
            }}
          >
            Yes
          </Tool>
          <Tool onClick={() => setConfirmClear(false)}>No</Tool>
        </>
      ) : (
        <Tool onClick={() => setConfirmClear(true)}>Clear page</Tool>
      )}
    </div>
  );
}

function Tool({ children, onClick }: { children: React.ReactNode; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="h-6 rounded border px-1.5 text-[11.5px] leading-none"
      style={{ borderColor: 'rgb(128 128 128 / 0.4)', background: 'transparent', color: 'inherit' }}
    >
      {children}
    </button>
  );
}
