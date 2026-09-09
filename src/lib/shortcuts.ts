export const SHORTCUTS = [
  { keys: 'Right arrow / PageDown', what: 'Next page', where: 'Both windows' },
  { keys: 'Left arrow / PageUp', what: 'Previous page', where: 'Both windows' },
  { keys: 'Space', what: 'Start or pause auto-scroll', where: 'Teleprompter' },
  { keys: '+ / -', what: 'Font size', where: 'Teleprompter' },
  { keys: 'Up / Down arrow', what: 'Scroll the script', where: 'Teleprompter' },
  { keys: 'D', what: 'Dark and light toggle', where: 'Both windows' },
  { keys: 'M', what: 'Mirror horizontally', where: 'Teleprompter' },
  { keys: 'H', what: 'Hide or show controls', where: 'Teleprompter' },
  { keys: 'R', what: 'Restart the script from the top', where: 'Teleprompter' },
  { keys: 'F', what: 'Full screen', where: 'Both windows' },
  { keys: 'T', what: 'Open or focus the teleprompter', where: 'Main window' },
  { keys: 'Escape', what: 'Leave full screen or restore controls', where: 'Both windows' },
];

/** True when a keystroke belongs to the user's text editing, not to a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}
