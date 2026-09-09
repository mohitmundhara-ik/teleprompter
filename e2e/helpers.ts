import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('stage')).toBeVisible();
}

/** The slide window has no controls, so a deck arrives through the file input. */
export async function loadFixture(page: Page, name = 'three-pages.pdf') {
  await page.setInputFiles('input[type=file]', join(FIXTURES, name));
  if (name.endsWith('.pdf')) await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
}

/** Triple-clicking the slide is the only way in, by design. */
export async function openPrompter(page: Page) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByTestId('stage').click({ clickCount: 3, position: { x: 40, y: 40 } }),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByTestId('prompter-count')).toBeVisible();
  return popup;
}

/** Page position is reported by the teleprompter, never by the slide window. */
export async function expectPage(popup: Page, text: string) {
  await expect(popup.getByTestId('prompter-count')).toHaveText(text);
}

export async function writeNote(popup: Page, text: string) {
  const editing = await popup.getByTestId('prompter-editor').count();
  if (!editing) await popup.getByRole('button', { name: 'Edit' }).click();
  await popup.getByTestId('prompter-editor').fill(text);
}
