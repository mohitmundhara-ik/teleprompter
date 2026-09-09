# Supported files and honest fidelity

| Format | Extensions | What you get | Limits |
| --- | --- | --- | --- |
| PDF | `.pdf` | Exact rendering, one page per slide, any page count | Password-protected files are rejected with a message. Very large files take a moment on first load. |
| PowerPoint | `.pptx` | Slide text and speaker notes, in order. With a converter configured: exact rendering via PDF. | Without the converter there is no layout, no images and no theme. This is a format limitation, not a rendering shortcut. |
| PowerPoint (legacy) | `.ppt` | Not supported | Binary format. Save as `.pptx` or export to PDF. Reported clearly on import. |
| Word | `.docx` | Headings, paragraphs, lists, tables and inline images, paginated by heading | Page breaks will not match Word exactly. Headers, footers and complex floats are dropped. |
| Word (legacy) | `.doc` | Not supported | Same as `.ppt`: save as `.docx` or PDF. |
| Images | `.png .jpg .jpeg .webp .gif .svg` | Exact, aspect ratio preserved. Select several and they become an ordered deck. | SVG is drawn as an image, so scripts inside it never run. |
| Video | `.mp4 .webm` | Native player plus play, pause, seek and speed from the teleprompter | Codec support is the browser's. Chrome and Edge play H.264 MP4 and VP8/VP9 WebM. |
| Audio | `.mp3 .wav .m4a` | Native player with the same remote controls | As above. |
| Text | `.txt .md` | Rendered cleanly, split on Markdown headings | Markdown is rendered as plain structured text, not full HTML. |
| Screen share | — | Live preview of a screen or window you pick | Slide controls are inactive: a browser cannot drive another application's slides. |

Maximum file size is 512 MB. Anything larger is refused with an explanation
rather than freezing the tab.

Scripts, notes and settings are never lost when an import fails. A rejected or
corrupt file leaves the current session exactly as it was.
