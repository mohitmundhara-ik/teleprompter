# PromptDeck

A presentation viewer with a synchronized teleprompter that lives in its own
resizable window. Load a deck, write your talk track, triple-click the slide,
and read your notes while the audience sees only the presentation.

Everything runs in the browser. Files are parsed on your machine and stored in
your browser. There is no account, no server, and no upload, unless you
deliberately configure the optional PowerPoint converter described below.

## Requirements

- Node.js 20 or newer
- Chrome or Edge on desktop for presenting (see Browser support)

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
```

Production:

```bash
npm run build          # type-check then bundle into dist/
npm run preview        # serve dist/ on http://localhost:4173
```

`dist/` is a static folder. Any static host works: Netlify, Vercel, S3 with
CloudFront, GitHub Pages, nginx. Two hosting rules:

1. Serve it over HTTPS or from `localhost`. Screen sharing and the crypto hash
   used for file identity need a secure context.
2. Serve `index.html` for unknown paths, or leave the default configuration
   alone. The teleprompter opens `index.html?prompter=1&session=<id>`, the same
   file with a query string, so no server-side routing rules are required.

No environment variables are needed, so there is no `.env.example`.

## Quick start

1. Drop a PDF, PPTX, DOCX, image, video, audio, TXT or MD file on the window.
2. Type your talk track in the right panel, or press `Import` and load a `.txt`
   or `.md` you already wrote. Any of these labels is recognised, on a line of
   its own:

   ```
   Slide 4              SLIDE 4 - TITLE        Slide 4: title
   --- Slide 4 ---      ## Slide 4             [Slide 4]
   Slides 5-28          Slides 5 to 28         Page 4
   Before slide 1       After slide 28
   ```

   An imported script is mapped onto the pages straight away: each page gets
   only its own section, ranges fill every page they cover, `before slide 4`
   and `after slide 4` join page 4, and separator rules such as `=======` and
   any header above the first marker are dropped. `Slide notes` shows one page
   at a time, `Full script` shows the whole thing and scrolls itself to the
   slide you are on.
3. Triple-click the slide. You can do this before loading anything, so you can
   write the script first and bring the deck in later. The teleprompter opens in its own window: drag it to
   a second monitor, or park it under your webcam and size it down to a strip.
4. Press `Present`, or `P`. The slide fills the tab and nothing else is drawn:
   no toolbar, no notes panel, no controls, no messages, not even a cursor. In
   Zoom or Meet choose `Share`, then this browser tab, and the audience sees the
   slide alone. Present asks the browser for real full screen, so the tab fills
   the monitor and there is no address bar or tab strip on screen either.
5. Drive it from the teleprompter window, which is a separate window and never
   part of the shared tab, or with the arrow keys. `Escape` leaves presenting.
6. `Next` and `Prev` work in either window. Both stay in step.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | TypeScript project build, then production bundle |
| `npm run preview` | Serve the production bundle |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint over `src` |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests (builds and serves automatically) |
| `npm run convert-server` | Optional PowerPoint converter, see below |

## Optional PowerPoint converter

A `.pptx` file contains shapes, text and theme rules, not pictures of slides.
PromptDeck rebuilds each slide from that shape tree in the browser: text with
its sizes and colours, pictures with their crops, fills, outlines, groups,
tables and the artwork inherited from the layout and master. Speaker notes come
across with it. This covers ordinary decks well, but it is a reconstruction:
gradients, shadows, charts, SmartArt and custom geometry are left out rather
than drawn wrongly.

For an exact match, run the bundled converter yourself:

```bash
npm run convert-server          # needs LibreOffice on the machine, listens on :8787
PORT=9000 ORIGIN=https://deck.example.com npm run convert-server
```

Then paste its address into Settings. From that point on, PromptDeck asks for
confirmation on every `.pptx` you load before sending it, converts it to PDF,
and renders the result at full fidelity. The service writes to a temporary
directory and deletes both input and output as soon as it responds. It stores
nothing.

If you would rather not run anything, export the deck to PDF from PowerPoint
and load the PDF. Same result, no service.

## Documentation

- `docs/ARCHITECTURE.md` — module layout, state, and how the two windows sync
- `docs/FILE-SUPPORT.md` — supported formats and their honest fidelity
- `docs/SHORTCUTS.md` — keyboard reference
- `docs/TEST-RESULTS.md` — what is tested and the latest run
- `docs/QA-CHECKLIST.md` — ten-minute manual pass before a real presentation

## Browser support

| Browser | Status |
| --- | --- |
| Chrome, Edge (desktop) | Tested. Everything works, including screen share and the popout. |
| Firefox (desktop) | Expected to work. `BroadcastChannel`, IndexedDB, PDF rendering and popouts are all supported. Not covered by the automated suite. |
| Safari (desktop) | Partial. Popouts open but Safari restricts window sizing and position; `getDisplayMedia` behaves differently and is only available in recent versions. Not covered by the automated suite. |
| Mobile browsers | Not a target. The layout is desktop-first and a phone cannot show two windows. |

## Privacy

- Files, scripts, notes and settings live in IndexedDB in your browser.
  `localStorage` holds only small preferences and the sync fallback.
- Nothing is uploaded unless you configure the converter and confirm each file.
- Imported HTML and SVG are sanitized against an allowlist. Macros, scripts and
  embedded objects in documents are discarded and never executed.
- `Settings → Delete all local data` removes everything, permanently.
