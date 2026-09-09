import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { Button, Divider, Panel } from './ui';
import { splitScriptByMarkers } from '../lib/format';
import { exportSession, importSessionJson } from '../lib/transfer';

export function NotesPanel() {
  const { index, script, notes, setScript, setNote, session, toast } = useStore(useShallow((s) => ({
    index: s.index,
    script: s.script,
    notes: s.notes,
    setScript: s.setScript,
    setNote: s.setNote,
    session: s.session,
    toast: s.toast,
  })));
  const [tab, setTab] = useState<'script' | 'notes'>('notes');
  const [confirmClear, setConfirmClear] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = tab === 'script' ? script : (notes[index] ?? '');

  useEffect(() => setConfirmClear(false), [tab, index]);

  const write = (text: string) => (tab === 'script' ? setScript(text) : setNote(index, text));

  const split = () => {
    const map = splitScriptByMarkers(script);
    if (!map.size) {
      toast('No slide markers found. Add lines such as "--- Slide 2 ---" to split the script.', 'warn');
      return;
    }
    for (const [i, text] of map) setNote(i, text);
    setTab('notes');
    toast(`Script split across ${map.size} pages.`);
  };

  return (
    <Panel
      title={tab === 'script' ? 'Presentation script' : `Notes for page ${index + 1}`}
      right={
        <div className="flex items-center gap-1">
          <Button size="sm" variant={tab === 'notes' ? 'primary' : 'ghost'} onClick={() => setTab('notes')}>
            Slide notes
          </Button>
          <Button size="sm" variant={tab === 'script' ? 'primary' : 'ghost'} onClick={() => setTab('script')}>
            Full script
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] px-2 py-1.5">
        <Button size="sm" onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied.'))}>
          Copy
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              write(value ? `${value}\n${text}` : text);
            } catch {
              toast('Your browser blocked clipboard reading. Use Ctrl+V in the editor.', 'warn');
            }
          }}
        >
          Paste
        </Button>
        <Button size="sm" onClick={() => ref.current?.select()}>Select all</Button>
        <Button size="sm" onClick={() => document.execCommand('undo')} title="Undo (Ctrl+Z inside the editor)">
          Undo
        </Button>
        <Divider />
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px]">
          Import
          <input
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
                } else {
                  write(await f.text());
                  toast('Script imported.');
                }
              } catch (err) {
                toast(err instanceof Error ? err.message : 'That file could not be imported.', 'error');
              }
            }}
          />
        </label>
        <Button size="sm" onClick={() => session && void exportSession(session, 'txt')}>Export .txt</Button>
        <Button size="sm" onClick={() => session && void exportSession(session, 'json')}>Export .json</Button>
        <Divider />
        <Button size="sm" onClick={split} title="Split the full script into per-page notes on Slide markers">
          Split by markers
        </Button>
        <span className="flex-1" />
        {confirmClear ? (
          <>
            <span className="text-[12px] text-[var(--ink-2)]">Clear this text?</span>
            <Button size="sm" variant="danger" onClick={() => { write(''); setConfirmClear(false); }}>
              Yes, clear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>Clear</Button>
        )}
      </div>
      <textarea
        ref={ref}
        data-testid="notes-editor"
        value={value}
        spellCheck={false}
        onChange={(e) => write(e.target.value)}
        placeholder={
          tab === 'script'
            ? 'Paste the full talk track here. Use lines like "--- Slide 2 ---" then press Split by markers.'
            : 'What you say on this page. Saved automatically and mirrored to the teleprompter.'
        }
        className="pd-scroll min-h-0 flex-1 resize-none bg-transparent p-3 text-[14px] leading-relaxed outline-none placeholder:text-[var(--ink-3)]"
      />
    </Panel>
  );
}
