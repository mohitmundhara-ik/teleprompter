import { useEffect, useState } from 'react';
import { ACCEPT, SUPPORTED } from '../adapters';
import { Button } from './ui';

export function DropZone({ onFiles, onShare }: { onFiles(files: File[]): void; onShare(): void }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const leave = () => {
      if (--depth <= 0) setOver(false);
    };
    const over_ = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setOver(false);
      if (e.dataTransfer?.files.length) onFiles([...e.dataTransfer.files]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over_);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over_);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onFiles]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="w-full max-w-[620px] rounded-xl border-2 border-dashed p-10 text-center transition-colors"
        style={{
          borderColor: over ? 'var(--accent)' : 'var(--line)',
          background: over ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
        }}
        data-testid="dropzone"
      >
        <h1 className="mb-2 text-[19px] font-semibold tracking-tight">Load something to present</h1>
        <p className="mx-auto mb-6 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          Drop a file anywhere in this window, or pick one. Everything is processed on this machine and stored in this
          browser. Nothing is uploaded.
        </p>
        <div className="mb-7 flex justify-center gap-2">
          <label>
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) onFiles([...e.target.files]);
                e.target.value = '';
              }}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-[13px] font-medium text-[var(--accent-ink)]">
              Choose file
            </span>
          </label>
          <Button onClick={onShare}>Share a screen instead</Button>
        </div>
        <table className="mx-auto text-left text-[12.5px] text-[var(--ink-3)]">
          <tbody>
            {SUPPORTED.map((s) => (
              <tr key={s.label}>
                <td className="py-0.5 pr-4 text-[var(--ink-2)]">{s.label}</td>
                <td className="py-0.5 pr-4 font-mono text-[11.5px]">{s.ext}</td>
                <td className="py-0.5">{s.fidelity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
