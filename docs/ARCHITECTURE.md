# Architecture

## Layout

```
src/
  main.tsx              entry; picks the main app or the teleprompter by query string
  App.tsx               main window shell: import, canvas, notes, screen share, keys
  types.ts              domain types shared by both windows
  adapters/             one module per file format, loaded on demand
    index.ts            registry: file -> LoadedDocument, plus the supported matrix
    pdf.ts pdfRuntime.ts  PDF.js document handling and page rendering
    pptx.ts pptxVisual.ts  PPTX package reading, and the slide renderer
    docx.ts simple.ts
  components/           Toolbar, Canvas, NotesPanel, DropZone, Sessions, Settings, ...
  teleprompter/         Prompter.tsx and the auto-scroll hook
  state/store.ts        one Zustand store per window, plus remote message handling
  sync/                 protocol.ts, transports.ts, bus.ts
  db/                   db.ts (Dexie) and schema.ts (Zod validation)
  lib/                  ids and hashing, formatting, sanitizer, prefs, popout, transfer
server/convert.mjs      optional self-hosted LibreOffice converter
e2e/                    Playwright specs and fixtures
```

Presentation state, persistence, sync transport and rendering adapters are
separate modules. Adding a format means adding one adapter and one line in the
registry; nothing else changes.

## The two windows

Both windows load the same bundle. `main.tsx` reads the query string: with
`?prompter=1&session=<id>` it mounts `Prompter`, otherwise `App`. The
teleprompter is opened with `window.open` from the click handler itself, so the
browser sees a direct user gesture. `lib/popout.ts` holds the single window
reference: a second triple-click focuses the existing window instead of opening
another. If `window.open` returns null the app shows a banner with a button and
a plain-tab link.

Only the main window renders documents. The teleprompter never loads PDF.js or
the DOCX engine, which is why the build is code-split by adapter.

## Synchronization

`sync/bus.ts` wraps a transport. `BroadcastChannel` is used when available and
a `localStorage` + `storage` event transport is the fallback. Every frame is an
envelope:

```ts
{ id, src, role, sid, ts, payload }
```

- `src` is a per-window id, so a window ignores its own echo.
- `id` is remembered in a bounded set, so duplicated frames are dropped.
- `sid` scopes the channel to one session; frames from another session are ignored.
- `role` is `main` or `prompter`, used for presence and for answering state requests.

A heartbeat goes out every second. A peer is considered gone after 3.2 seconds
without a frame, which is what drives `Connected` and
`Main presentation disconnected` in the teleprompter. When the connection comes
back, the teleprompter sends `state-request` and the main window replays
navigation, metadata, script and notes, so either window can reload at any time.

Payloads: `nav`, `meta`, `script`, `note`, `display`, `media`, `hello`,
`state-request`, `heartbeat`, `bye`.

Navigation from a popout that has not yet received `meta` is applied
optimistically and clamped by the main window, so an early click is never lost.
Text frames carry a revision number; a lower revision is ignored, and when the
receiving window has unsaved edits of its own it keeps the newer text and shows
a warning rather than discarding either silently. Last write wins, but never
quietly.

Both windows persist text they receive, so an edit typed in the teleprompter is
already on disk even if that window is closed a moment later. A `pagehide` and
`visibilitychange` handler flushes any debounced save immediately.

## Persistence

Dexie over IndexedDB, database `promptdeck`, version 1:

| Store | Key | Contents |
| --- | --- | --- |
| `sessions` | `id` | title, file name, kind, content hash, page count and titles, current page |
| `files` | `sessionId` | the original file as a Blob, so a reload re-renders it |
| `scripts` | `sessionId` | the running script and its revision |
| `notes` | `sessionId:pageIndex` | per-page notes and revisions |
| `prefs` | `key` | teleprompter display settings |

Schema versions are added, never replaced, so a deployment cannot wipe a
presenter's scripts. Everything read back from storage or from an imported
`.json` is validated with Zod before use; invalid display settings fall back to
the defaults instead of breaking the window.

File identity is a SHA-256 of the first 8 MB plus the byte size. Reopening the
same deck finds the previous session by hash and reattaches its notes.

Writes are debounced by 400 ms and reported in the toolbar as
`Saving… / Saved / Save failed`. A quota failure is surfaced as an error toast
that tells the presenter to export the script, and never clears the text.

## Rendering

- PDF: PDF.js draws each page to a canvas at device pixel ratio, capped at 2x,
  re-rendered on resize and zoom. `fit`, `fit width` and fixed zoom levels.
- Images: object URLs, aspect ratio preserved, never cropped.
- Media: native `<video>`/`<audio>` with controls; the element registers a
  controller in the store so the teleprompter can drive play, pause, seek and
  rate over the bus.
- DOCX: mammoth converts to HTML locally, the allowlist sanitizer strips
  anything active, then the document is split into pages on top-level headings
  with a size cap for heading-free documents.
- PPTX: JSZip reads the package, `pptxVisual.ts` walks each slide's shape tree
  and rebuilds it as absolutely positioned HTML at the deck's real pixel size,
  which the canvas then scales to fit. It resolves theme colours, placeholder
  geometry inherited from the layout and master, master and layout artwork
  drawn behind the slide, nested groups with their child coordinate spaces,
  picture relationships and `srcRect` crops, tables, and text run formatting.
  Slide text and speaker notes are read separately, so a deck whose shapes
  cannot be drawn still falls back to readable text pages. With a converter
  configured, the file is converted to PDF and rendered through the PDF path.

## Triple-click

The canvas listens for `detail === 3`. It ignores clicks on controls, links,
form fields and media, and inside selectable document text where triple-click is
the browser's own select-paragraph gesture. On a slide, where a triple click
selects nothing meaningful, the accidental selection is cleared and the
teleprompter opens.

## Screen share

`getDisplayMedia` is called only from a click. The stream is previewed in the
canvas and stopped explicitly or when the browser ends it. A web page cannot
advance slides inside PowerPoint or Keynote, so in this mode the app says so on
screen instead of pretending. A desktop helper or browser extension could bridge
that later; nothing in v1 depends on one.
