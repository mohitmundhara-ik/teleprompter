import type { DisplaySettings, ThemeMode } from '../types';

export const DEFAULT_DISPLAY: DisplaySettings = {
  fontSize: 30,
  lineHeight: 1.55,
  columnWidth: 92,
  align: 'left',
  palette: 'dark',
  mirrorX: false,
  mirrorY: false,
  scrollSpeed: 40,
  guideOffset: 0,
  controlsHidden: false,
  followSlides: true,
  source: 'notes',
};

export const PALETTES: Record<DisplaySettings['palette'], { bg: string; fg: string; label: string }> = {
  dark: { bg: '#0d1116', fg: '#e8eef5', label: 'Dark' },
  light: { bg: '#f7f8fa', fg: '#14181d', label: 'Light' },
  contrast: { bg: '#000000', fg: '#ffffff', label: 'High contrast' },
  amber: { bg: '#0d0b06', fg: '#ffd18a', label: 'Amber' },
  green: { bg: '#04120a', fg: '#9dffc4', label: 'Green' },
};

export const THEME_KEY = 'promptdeck.theme';
export const HINT_KEY = 'promptdeck.hintDismissed';
export const PRESENT_TIP_KEY = 'promptdeck.presentTipDismissed';
export const LAST_SESSION_KEY = 'promptdeck.lastSession';

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota: preferences degrade to session-only */
  }
}

export function readTheme(): ThemeMode {
  const v = safeGet(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function applyTheme(mode: ThemeMode, doc: Document = document) {
  const system = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  doc.documentElement.dataset.theme = mode === 'system' ? system : mode;
}
