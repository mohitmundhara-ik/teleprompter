import { describe, expect, it } from 'vitest';
import { displaySettingsSchema, exportSchema } from './schema';
import { DEFAULT_DISPLAY } from '../lib/prefs';

describe('persisted data validation', () => {
  it('accepts the default display settings', () => {
    expect(displaySettingsSchema.safeParse(DEFAULT_DISPLAY).success).toBe(true);
  });

  it('rejects out-of-range settings from a tampered store', () => {
    expect(displaySettingsSchema.safeParse({ ...DEFAULT_DISPLAY, fontSize: 9999 }).success).toBe(false);
    expect(displaySettingsSchema.safeParse({ ...DEFAULT_DISPLAY, palette: 'neon' }).success).toBe(false);
  });

  it('rejects a JSON file that is not a session export', () => {
    expect(exportSchema.safeParse({ hello: 'world' }).success).toBe(false);
  });

  it('accepts a well formed export', () => {
    const ok = exportSchema.safeParse({
      format: 'promptdeck.session',
      version: 1,
      exportedAt: Date.now(),
      session: {
        id: 's1', title: 'Deck', fileName: 'a.pdf', mimeType: 'application/pdf', kind: 'pdf',
        docHash: 'h', pageCount: 3, pageTitles: ['1', '2', '3'], currentIndex: 0,
        createdAt: 1, updatedAt: 2,
      },
      script: { sessionId: 's1', text: 'hello', rev: 1, updatedAt: 2 },
      notes: [{ key: 's1:0', sessionId: 's1', pageIndex: 0, text: 'n', rev: 1, updatedAt: 2 }],
    });
    expect(ok.success).toBe(true);
  });
});
