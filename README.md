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

1. Drop a deck anywhere in the window, or press `O`.
2. Triple-click the slide. The teleprompter opens in its own window: script,
   Prev and Next, reading controls, import and export, all of it.
3. Share this browser tab in Zoom or Meet. The slide window has no toolbar, no
   notes panel and no messages; every control lives in the teleprompter, which a
   tab share never includes. `F` fills the monitor.
4. Label a long script with lines like `--- Slide 2 ---` and the teleprompter
   maps it onto the pages by itself. Any of these labels work, on a line of
   their own:

   ```
   Slide 4              SLIDE 4 - TITLE        Slide 4: title
   --- Slide 4 ---      ## Slide 4             [Slide 4]
   Slides 5-28          Slides 5 to 28         Page 4
   Before slide 1       After slide 28
   ```

## Keys, since the slide window has no buttons

`→` next, `←` previous, `T` teleprompter, `O` open a file, `N` new session,
`S` sessions, `,` settings, `F` full screen, `D` dark and light, `?` the full
list. See `docs/SHORTCUTS.md`.

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
