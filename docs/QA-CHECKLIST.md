# Manual QA checklist

Ten minutes, before you rely on this in a real session. Chrome or Edge.

## Import and render
1. Drop a multi-page PDF. Pages appear, the counter reads `1 / n`, nothing is cropped.
2. Switch zoom between Fit screen, Fit width and 200%. The page redraws sharply each time.
3. Load a `.pptx`. Slides appear as text, the notice about PowerPoint fidelity appears once.
4. Load a video. It plays with native controls.
5. Load a junk file renamed `.pdf`. You get a readable error and your notes are untouched.

## Notes and saving
6. Type notes on three different pages. The toolbar goes `Saving…` then `Saved`.
7. Reload the page. The deck reopens and each page still has its own notes.
8. Paste a long script into Full script with `--- Slide 2 ---` markers, press
   Split by markers, confirm the pieces land on the right pages.
9. Export `.json`, then Sessions → Delete, then import the `.json` back.

## Teleprompter
10. Triple-click the slide. Exactly one window opens.
11. Triple-click again. The same window comes forward, no duplicate.
12. Press Next in the teleprompter. The main window moves immediately.
13. Press Previous in the main window. The teleprompter shows the previous page's notes.
14. Edit the notes inside the teleprompter. The main window updates as you type.
15. Change font size, line spacing, column width, palette and mirror. Close the
    window and reopen it. Every setting is still as you left it.
16. Drag the window down to a narrow strip. Prev, Next and the script all stay usable.
17. Start auto-scroll with Space, change speed, press R to jump back to the top.
18. Close the main window. The teleprompter says `Main presentation disconnected`
    and still shows your script.

## Screen share
19. Press Share screen, pick a window, confirm the live preview and the note that
    slide controls are inactive.
20. Confirm the teleprompter window is not the one being shared, then stop sharing.

## Keyboard
21. With focus in the notes editor, press the arrow keys. The page must not change.
22. Click the slide, press the arrow keys. The page changes.
