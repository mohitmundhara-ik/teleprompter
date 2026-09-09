/** Core domain types shared by the main window and the teleprompter popout. */

export type DocKind = 'pdf' | 'image' | 'video' | 'audio' | 'doc' | 'slides' | 'text' | 'screen';

/** One navigable unit: a PDF page, a slide, an image, a doc section. */
export interface Page {
  index: number;
  title: string;
  /** How the canvas should draw it. */
  render:
    | { type: 'pdf'; pageNumber: number }
    | { type: 'image'; url: string }
    | { type: 'html'; html: string }
    | { type: 'slide'; html: string; width: number; height: number }
    | { type: 'text'; title: string; body: string[] }
    | { type: 'media'; url: string; mime: string; audio: boolean }
    | { type: 'screen' };
}

export interface LoadedDocument {
  kind: DocKind;
  title: string;
  pages: Page[];
  /** Warnings surfaced to the user, e.g. reduced fidelity. */
  notices: string[];
}

export interface SessionRecord {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  kind: DocKind;
  /** Content hash + size, so reopening the same file restores its notes. */
  docHash: string;
  pageCount: number;
  pageTitles: string[];
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScriptRecord {
  sessionId: string;
  text: string;
  rev: number;
  updatedAt: number;
}

export interface NoteRecord {
  key: string; // `${sessionId}:${pageIndex}`
  sessionId: string;
  pageIndex: number;
  text: string;
  rev: number;
  updatedAt: number;
}

export interface FileRecord {
  sessionId: string;
  blob: Blob;
  name: string;
  type: string;
}

export type ThemeMode = 'dark' | 'light' | 'system';

/** Teleprompter reading settings. Persisted and mirrored across windows. */
export interface DisplaySettings {
  fontSize: number;        // px
  lineHeight: number;      // unitless
  columnWidth: number;     // percent of window width
  align: 'left' | 'center' | 'right';
  palette: 'dark' | 'light' | 'contrast' | 'amber' | 'green';
  mirrorX: boolean;
  mirrorY: boolean;
  scrollSpeed: number;     // px per second
  guideOffset: number;     // percent from top, 0 disables
  controlsHidden: boolean;
  /** Keep the script aligned with the slide the main window is showing. */
  followSlides: boolean;
  source: 'notes' | 'script';
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
