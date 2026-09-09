import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIXTURES, loadFixture, openApp, typeNote } from './helpers';

test('notes stay attached to the right page across a reload', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('1 / 3');

  await typeNote(page, 'notes for page one');
  await page.getByRole('button', { name: 'Next' }).click();
  await typeNote(page, 'notes for page two');
  await page.getByRole('button', { name: 'Next' }).click();
  await typeNote(page, 'notes for page three');

  await page.reload();
  await expect(page.getByTestId('page-indicator')).toHaveText('3 / 3', { timeout: 15000 });
  await expect(page.getByTestId('notes-editor')).toHaveValue('notes for page three');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByTestId('notes-editor')).toHaveValue('notes for page two');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByTestId('notes-editor')).toHaveValue('notes for page one');
});

test('every page renders and the order never changes', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByTestId('page-indicator')).toHaveText(`${i} / 3`);
    const box = await page.locator('canvas').boundingBox();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);
    if (i < 3) await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText('3 / 3');
});

test('a corrupt file reports an error and keeps existing notes', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await typeNote(page, 'work I do not want to lose');

  await page.setInputFiles('input[type=file]', join(FIXTURES, 'broken.pdf'));
  await expect(page.getByRole('status')).toContainText(/could not be opened|corrupt/i);
  await expect(page.getByTestId('notes-editor')).toHaveValue('work I do not want to lose');
});

test('arrow keys navigate but never while typing', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.getByTestId('canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');

  const editor = page.getByTestId('notes-editor');
  await editor.click();
  await editor.fill('abc');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');
  await expect(editor).toHaveValue('abc');
});
