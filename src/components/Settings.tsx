import { useEffect, useState } from 'react';
import { Modal } from './Sessions';
import { Button, Field } from './ui';
import { converterUrl, setConverterUrl } from '../lib/converter';
import { deleteAll, estimateUsage } from '../db/db';
import { bytes } from '../lib/format';
import { SHORTCUTS } from '../lib/shortcuts';

export function Settings({ onClose, onWiped }: { onClose(): void; onWiped(): void }) {
  const [url, setUrl] = useState(converterUrl());
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void estimateUsage().then(setUsage);
  }, []);

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="grid gap-6 p-5">
        <section className="grid gap-3">
          <h3 className="text-[13px] font-semibold">PowerPoint conversion</h3>
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-[var(--ink-2)]">
            A browser cannot draw a .pptx with its original design, because the file stores shapes and theme rules
            rather than images. Run the bundled converter (server/convert.mjs, LibreOffice) on your own machine or
            network and paste its address here. Files are then sent to that service only, and only after you confirm
            the upload each time. Leave this empty to keep every file on this machine and import slide text only.
          </p>
          <Field label="Converter address" hint="Example: http://localhost:8787">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8787"
              className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px]"
            />
          </Field>
          <div>
            <Button onClick={() => setConverterUrl(url)}>Save converter address</Button>
          </div>
        </section>

        <section className="grid gap-2 border-t border-[var(--line)] pt-5">
          <h3 className="text-[13px] font-semibold">Local data</h3>
          <p className="text-[13px] text-[var(--ink-2)]">
            {usage
              ? `Using ${bytes(usage.usage)} of roughly ${bytes(usage.quota)} available in this browser.`
              : 'This browser does not report a storage estimate.'}
          </p>
          <div className="flex gap-2">
            {confirm ? (
              <>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await deleteAll();
                    setConfirm(false);
                    onWiped();
                  }}
                >
                  Delete everything permanently
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirm(true)}>Delete all local data</Button>
            )}
          </div>
        </section>

        <section className="grid gap-2 border-t border-[var(--line)] pt-5">
          <h3 className="text-[13px] font-semibold">Keyboard shortcuts</h3>
          <table className="text-[13px]">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td className="w-[190px] py-1 font-mono text-[12px] text-[var(--ink-2)]">{s.keys}</td>
                  <td className="py-1">{s.what}</td>
                  <td className="py-1 pl-3 text-[12px] text-[var(--ink-3)]">{s.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] text-[var(--ink-3)]">Shortcuts are ignored while you are typing in an editor.</p>
        </section>
      </div>
    </Modal>
  );
}
