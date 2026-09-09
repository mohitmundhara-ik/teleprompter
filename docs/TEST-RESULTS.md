# Test results

Recorded on the machine used to build this, Node 22, Chromium 153 via Playwright.
Reproduce with `npm run lint && npm run typecheck && npm test && npm run e2e`.

## Static checks

- `npm run typecheck` — clean, no errors.
- `npm run lint` — clean, no errors and no warnings.
- `npm run build` — succeeds. Entry chunk 147 kB, teleprompter chunk 8.5 kB,
  PDF, DOCX and PPTX engines split into separate chunks loaded on demand.

## Unit tests, Vitest: 29 passed

| File | Covers |
| --- | --- |
| `lib/format.test.ts` | script splitting and slide-number parsing on `--- Slide N ---`, `## Slide N`, `[Slide N]`, blank sections, byte and relative time formatting |
| `lib/sanitize.test.ts` | scripts, event handlers, `javascript:` URLs and iframes removed; headings, lists, tables and safe links kept |
| `lib/id.test.ts` | id uniqueness, identical content hashing to the same value, note keys |
| `lib/shortcuts.test.ts` | the typing guard, and that every shortcut is documented |
| `sync/bus.test.ts` | delivery between windows, no self-echo, duplicate frames dropped, other sessions ignored, presence reporting |
| `db/schema.test.ts` | display settings and session exports validated, tampered values rejected |

## End-to-end tests, Playwright, Chromium: 15 passed

`e2e/presentation.spec.ts`
1. Notes stay attached to the right page across a reload.
2. Every PDF page renders, in order, without cropping, and the last page does not run past the end.
3. A corrupt file reports an error and existing notes survive.
4. Arrow keys navigate, and are ignored while typing in the editor.

`e2e/teleprompter.spec.ts`
5. Triple-click opens exactly one popout; a second triple-click focuses it rather than duplicating.
6. Next in the popout moves the main window, and Previous in the main window moves the popout.
7. The popout always shows the notes for the page the main window is on.
8. An edit made in the popout survives closing it and reloading the main window.
9. Font size and mirroring persist after the popout is closed and reopened; at 280 px wide, Prev, Next and the script stay usable.
10. Closing the main window puts the popout into `Main presentation disconnected` with the script still readable.
11. Triple-click opens the teleprompter with nothing loaded, and a script typed there reaches the main window.
12. Slide numbers written in the script are detected: each page shows its own section and Next moves to the next one.

`e2e/formats.spec.ts`
13. A `.pptx` loads all slides in order, drawn as slides at the deck's aspect ratio, with their text and the fidelity notice.
14. Video play, pause and seek are driven from the teleprompter.
15. A cancelled screen share reports the reason instead of failing silently.

## Bugs this suite caught, and the fixes

- Triple-click never fired, because the browser's select-paragraph behaviour
  tripped the selection guard. The guard now only defers to selection inside
  real document text.
- The popout took its page count from the stored session record, so a popout
  opened before the deck finished loading clamped Next to page one and sent
  nothing. Deck metadata is now synced state.
- Navigation sent before metadata arrived was dropped. It is now applied
  optimistically and clamped by the main window, and the popout re-requests
  state whenever the connection returns.
- Attaching a document reset the page index, discarding a navigation that
  arrived while the file was loading.
- Saving blocked first paint, so a reload during the initial write lost the
  session. The deck now renders first and persists in the background.
- An edit typed in the popout could be lost if that window closed inside the
  400 ms autosave debounce. Received text is now persisted by both windows, and
  pending saves are flushed on `pagehide`.

## Not covered by automation

- Firefox and Safari. Chromium only in CI.
- The real `getDisplayMedia` picker, which cannot be driven headlessly. The
  cancellation path is tested; the successful path is in the manual checklist.
- The optional converter is verified by hand: a 50-slide `.pptx` posted to
  `server/convert.mjs` returned a valid 50-page PDF.
- PPTX rendering fidelity is verified by eye against a real 50-slide deck,
  comparing browser output with the same slides converted by LibreOffice.
  Titles, body text, cards, accent bars, nested rounded shapes, tables, logos
  and master artwork match closely; colours and positions line up. Checking
  this automatically would need visual diffing, which is not set up.
