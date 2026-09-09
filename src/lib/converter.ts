const CONVERTER_KEY = 'promptdeck.converterUrl';

/** Address of the user's own conversion service. Empty means local-only mode. */
export function converterUrl(): string {
  try {
    return localStorage.getItem(CONVERTER_KEY) || '';
  } catch {
    return '';
  }
}

export function setConverterUrl(url: string) {
  try {
    localStorage.setItem(CONVERTER_KEY, url.trim());
  } catch {
    /* preferences unavailable in this browser mode */
  }
}
