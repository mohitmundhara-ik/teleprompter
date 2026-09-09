/**
 * One teleprompter popout per session. Opened from a direct user gesture so
 * the browser treats it as user-initiated rather than an unsolicited popup.
 */
let ref: Window | null = null;

export const prompterUrl = (sessionId: string) =>
  `${location.origin}${location.pathname}?prompter=1&session=${encodeURIComponent(sessionId)}`;

export function openPrompter(sessionId: string): { ok: boolean; focused: boolean } {
  if (ref && !ref.closed) {
    ref.focus();
    return { ok: true, focused: true };
  }
  const w = 520;
  const h = 620;
  const left = Math.max(0, (window.screen.availWidth ?? 1280) - w - 40);
  const top = 80;
  const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const win = window.open(prompterUrl(sessionId), `promptdeck_${sessionId}`, features);
  if (!win) return { ok: false, focused: false };
  ref = win;
  return { ok: true, focused: false };
}

export const prompterWindow = () => (ref && !ref.closed ? ref : null);
export const closePrompter = () => {
  if (ref && !ref.closed) ref.close();
  ref = null;
};
