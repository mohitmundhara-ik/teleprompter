import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export async function loadFixture(page: Page, name = 'three-pages.pdf') {
  await page.setInputFiles('input[type=file]', join(FIXTURES, name));
  // Wait for the deck to be on screen, the way a presenter would before
  // opening the teleprompter.
  if (name === 'three-pages.pdf') await expect(page.getByTestId('page-indicator')).toHaveText('1 / 3');
}

export async function openApp(page: Page, sessionId?: string) {
  await page.goto(sessionId ? `/?session=${sessionId}` : '/');
  await expect(page.getByTestId('dropzone').or(page.getByTestId('canvas'))).toBeVisible();
}

/** The session id in the address bar, or the one saved for the next visit. */
export async function currentSession(page: Page) {
  return page.evaluate(() => localStorage.getItem('promptdeck.lastSession'));
}

export async function openPrompter(page: Page) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Teleprompter' }).click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByTestId('prompter-count')).toBeVisible();
  return popup;
}

export async function tripleClickCanvas(page: Page) {
  await page.getByTestId('canvas').click({ clickCount: 3, position: { x: 40, y: 40 } });
}

export async function typeNote(page: Page, text: string) {
  const editor = page.getByTestId('notes-editor');
  await editor.click();
  await editor.fill(text);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 4000 });
}
