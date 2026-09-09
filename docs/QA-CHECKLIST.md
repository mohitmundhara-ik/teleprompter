# Manual QA checklist

Ten minutes, before you rely on this in a real session. Chrome or Edge.

## Import and render
1. Drop a multi-page PDF. Pages appear, the counter reads `1 / n`, nothing is cropped.
2. Switch zoom between Fit screen, Fit width and 200%. The page redraws sharply each time.
3. Load a `.pptx`. Slides are drawn with their layout, pictures and colours, and the notice about reconstruction fidelity appears once. Compare two or three slides against PowerPoint.
4. Load a video. It plays with native controls.
5. Load a junk file renamed `.pdf`. You get a readable error and your notes are untouched.

## Notes and saving
6. Type notes on three different pages. The toolbar goes `Saving…` then `Saved`.
7. Reload the page. The deck reopens and each page still has its own notes.
8. Import a talk track labelled `SLIDE 2 - TITLE`, or paste one and press
   Split by markers. Check three pages: each holds its own section only, with no
   header, no separator rules and nothing from other slides.
9. Export `.json`, then Sessions → Delete, then import the `.json` back.

## Teleprompter
10. With nothing loaded, triple-click the empty stage. The teleprompter opens and you can type in it.
11. Load a deck, then triple-click the slide. Exactly one window opens.
12. Triple-click again. The same window comes forward, no duplicate.
13. Press Next in the teleprompter. The main window moves immediately.
14. Press Previous in the main window. The teleprompter shows the previous page's notes.
15. Write a script with `--- Slide 2 ---` markers in Full script. Confirm the
    teleprompter shows each page's own section and the Follow button appears.
16. Edit the notes inside the teleprompter. The main window updates as you type.
17. Change font size, line spacing, column width, palette and mirror. Close the
    window and reopen it. Every setting is still as you left it.
18. Drag the window down to a narrow strip. Prev, Next and the script all stay usable.
19. Start auto-scroll with Space, change speed, press R to jump back to the top.
20. Close the main window. The teleprompter says `Main presentation disconnected`
    and still shows your script.

## Presenting
25. Press Present. The slide fills the tab. Nothing else is on screen and the cursor is gone.
26. Move the mouse around: still nothing appears.
27. Share this tab in Zoom or Meet and confirm the audience sees only the slide.
28. Change pages from the teleprompter and with the arrow keys; confirm the shared tab follows.
29. Press Escape and confirm the normal layout returns on the page you ended on.

## Screen share
21. Press Share screen, pick a window, confirm the live preview and the note that
    slide controls are inactive.
22. Confirm the teleprompter window is not the one being shared, then stop sharing.

## Keyboard
23. With focus in the notes editor, press the arrow keys. The page must not change.
24. Click the slide, press the arrow keys. The page changes.
