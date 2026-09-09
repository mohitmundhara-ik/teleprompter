import { useEffect, useState } from 'react';
import { deleteSession, listSessions } from '../db/db';
import type { SessionRecord } from '../types';
import { Button } from './ui';
import { timeAgo } from '../lib/format';
import { exportSession } from '../lib/transfer';

export function Sessions({ onOpen, onClose }: { onOpen(id: string): void; onClose(): void }) {
  const [rows, setRows] = useState<SessionRecord[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = () => listSessions().then(setRows);
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Modal title="Recent sessions" onClose={onClose}>
      {!rows ? (
        <p className="p-4 text-[var(--ink-2)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-[var(--ink-2)]">No sessions yet. Upload a file to create one.</p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="text-[12px] text-[var(--ink-3)]">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Progress</th>
              <th className="px-2 py-2 font-medium">Last opened</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-[var(--line)]">
                <td className="max-w-[280px] truncate px-4 py-2">{s.title}</td>
                <td className="px-2 py-2 text-[var(--ink-2)]">{s.kind}</td>
                <td className="px-2 py-2 tabular-nums text-[var(--ink-2)]">
                  {s.pageCount ? `${Math.min(s.currentIndex + 1, s.pageCount)} / ${s.pageCount}` : '—'}
                </td>
                <td className="px-2 py-2 text-[var(--ink-2)]">{timeAgo(s.updatedAt)}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" onClick={() => onOpen(s.id)}>Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => void exportSession(s, 'json')}>Export</Button>
                    {confirm === s.id ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          await deleteSession(s.id);
                          setConfirm(null);
                          void refresh();
                        }}
                      >
                        Confirm delete
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(s.id)}>Delete</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[min(860px,94vw)] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]"
      >
        <header className="flex h-11 shrink-0 items-center border-b border-[var(--line)] px-4">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <span className="flex-1" />
          <button onClick={onClose} aria-label="Close" className="text-[var(--ink-3)] hover:text-[var(--ink)]">✕</button>
        </header>
        <div className="pd-scroll min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
