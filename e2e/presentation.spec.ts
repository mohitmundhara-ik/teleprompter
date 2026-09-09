import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIXTURES, loadFixture, openApp, openPrompter, typeNote } from './helpers';

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

test('present mode shows the slide and nothing else at all', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);

  await page.getByRole('button', { name: 'Present' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  // Anything on screen here would be shared with the audience.
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('notes-editor')).toHaveCount(0);
  await expect(page.getByTestId('page-indicator')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);

  // It stays bare when the mouse moves, and the cursor is hidden too.
  await page.mouse.move(300, 300);
  await page.waitForTimeout(400);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('stage')).toHaveCSS('cursor', 'none');

  const stage = await page.getByTestId('stage').boundingBox();
  const view = page.viewportSize()!;
  expect(stage!.width).toBe(view.width);
  expect(stage!.height).toBe(view.height);

  // Keyboard still drives it, and Escape brings the working layout back.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');
});

test('the teleprompter still drives a presenting tab', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);

  await page.getByRole('button', { name: 'Present' }).click();
  await popup.getByTestId('prompter-next').click();
  await expect(popup.getByTestId('prompter-count')).toHaveText('2 / 3');

  // The presenting tab followed, without drawing anything to say so.
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');
});

test('a labelled talk track maps onto the pages and survives a reload', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);

  await page.setInputFiles('input[accept=".txt,.md,.markdown,.json"]', join(FIXTURES, 'talk-track.txt'));
  await expect(page.getByRole('status')).toContainText(/mapped onto \d+ pages/);

  // Page one holds its own body and none of the file's header or other slides.
  const editor = page.getByTestId('notes-editor');
  await expect(editor).toContainText('That is loop engineering');
  await expect(editor).not.toContainText('YOUR FLOW');
  await expect(editor).not.toContainText('A QUICK INTRODUCTION');
  await expect(editor).not.toContainText('====');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(editor).toContainText('Interview Kickstart');
  await expect(editor).not.toContainText('That is loop engineering');

  await page.reload();
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3', { timeout: 15000 });
  await expect(page.getByTestId('notes-editor')).toContainText('Interview Kickstart');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByTestId('notes-editor')).toContainText('That is loop engineering');
});
