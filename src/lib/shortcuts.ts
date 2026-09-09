export const SHORTCUTS = [
  { keys: '→ / Page Down', what: 'Next page', where: 'Both windows' },
  { keys: '← / Page Up', what: 'Previous page', where: 'Both windows' },
  { keys: 'T', what: 'Open or focus the teleprompter', where: 'Slide window' },
  { keys: 'Triple-click', what: 'The same thing, without the keyboard', where: 'Slide window' },
  { keys: 'O', what: 'Open a file', where: 'Slide window' },
  { keys: 'N', what: 'Start a new session', where: 'Slide window' },
  { keys: 'S', what: 'Recent sessions', where: 'Slide window' },
  { keys: ',', what: 'Settings', where: 'Slide window' },
  { keys: 'F', what: 'Full screen', where: 'Both windows' },
  { keys: 'D', what: 'Dark and light', where: 'Both windows' },
  { keys: '?', what: 'This list', where: 'Slide window' },
  { keys: 'Space', what: 'Start or pause auto-scroll', where: 'Teleprompter' },
  { keys: '↑ / ↓', what: 'Scroll the script by hand', where: 'Teleprompter' },
  { keys: '+ / -', what: 'Font size', where: 'Teleprompter' },
  { keys: 'M', what: 'Mirror horizontally, for prompter glass', where: 'Teleprompter' },
  { keys: 'H', what: 'Hide or show the controls', where: 'Teleprompter' },
  { keys: 'R', what: 'Restart the script from the top', where: 'Teleprompter' },
  { keys: 'Escape', what: 'Close a panel, or leave full screen', where: 'Both windows' },
];

/** True when a keystroke belongs to the user's text editing, not to a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}
