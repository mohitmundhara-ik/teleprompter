import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIXTURES, expectPage, loadFixture, openApp, openPrompter, writeNote } from './helpers';

test('the slide window shows the slide and no controls at all', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);

  // Nothing here that an audience should not see. The one input is the hidden
  // file picker, which is off screen.
  await expect(page.locator('button')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.locator('input:not(.sr-only)')).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();

  const stage = await page.getByTestId('stage').boundingBox();
  const view = page.viewportSize()!;
  expect(stage!.width).toBe(view.width);
  expect(stage!.height).toBe(view.height);
});

test('notes stay attached to the right page across a reload', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);
  await expectPage(popup, '1 / 3');

  await writeNote(popup, 'notes for page one');
  await popup.getByTestId('prompter-next').click();
  await writeNote(popup, 'notes for page two');
  await popup.getByTestId('prompter-next').click();
  await writeNote(popup, 'notes for page three');
  await popup.getByRole('button', { name: 'Done' }).click();
  await popup.waitForTimeout(700);

  // The teleprompter stays open and reconnects by itself when the slide window
  // reloads: no second window, no lost script.
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
  await expect(popup.getByTestId('conn-status')).toHaveText('Connected', { timeout: 10000 });
  await expectPage(popup, '3 / 3');
  await expect(popup.getByTestId('prompter-text')).toContainText('notes for page three');
  await popup.getByTestId('prompter-prev').click();
  await expect(popup.getByTestId('prompter-text')).toContainText('notes for page two');
});

test('arrow keys move the deck, and the teleprompter follows', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);

  await page.getByTestId('stage').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ArrowRight');
  await expectPage(popup, '2 / 3');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expectPage(popup, '3 / 3');
  await page.keyboard.press('ArrowLeft');
  await expectPage(popup, '2 / 3');
});

test('keys are ignored while the presenter is typing a script', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);
  await popup.getByTestId('prompter-next').click();
  await expectPage(popup, '2 / 3');

  await writeNote(popup, 'abc');
  await popup.keyboard.press('ArrowRight');
  await popup.keyboard.press('ArrowLeft');
  await expectPage(popup, '2 / 3');
  await expect(popup.getByTestId('prompter-editor')).toHaveValue('abc');
});

test('a corrupt file reports itself in the teleprompter and keeps the script', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);
  await writeNote(popup, 'work I do not want to lose');
  await popup.getByRole('button', { name: 'Done' }).click();

  await page.setInputFiles('input[type=file]', join(FIXTURES, 'broken.pdf'));
  // The message goes to the private window, not onto the shared slide.
  await expect(popup.getByRole('status')).toContainText(/could not be opened|corrupt/i);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(popup.getByTestId('prompter-text')).toContainText('work I do not want to lose');
});

test('a labelled talk track maps onto the pages from the teleprompter', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);

  await popup.getByRole('button', { name: 'Script tools', exact: true }).click();
  await popup.setInputFiles('input[accept=".txt,.md,.markdown,.json"]', join(FIXTURES, 'talk-track.txt'));
  await expect(popup.getByRole('status')).toContainText(/mapped onto \d+ pages/);

  await expect(popup.getByTestId('prompter-text')).toContainText('That is loop engineering');
  await expect(popup.getByTestId('prompter-text')).not.toContainText('YOUR FLOW');
  await popup.getByTestId('prompter-next').click();
  await expect(popup.getByTestId('prompter-text')).toContainText('Interview Kickstart');

  await page.reload();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
  await expect(popup.getByTestId('conn-status')).toHaveText('Connected', { timeout: 10000 });
  await expect(popup.getByTestId('prompter-text')).toContainText('Interview Kickstart');
});
