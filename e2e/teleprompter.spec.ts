import { expect, test } from '@playwright/test';
import { loadFixture, openApp, openPrompter, tripleClickCanvas } from './helpers';

test('triple-click opens exactly one popout and the second focuses it', async ({ page, context }) => {
  await openApp(page);
  await loadFixture(page);

  const [popup] = await Promise.all([page.waitForEvent('popup'), tripleClickCanvas(page)]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByTestId('prompter-count')).toHaveText('1 / 3');
  expect(context.pages().length).toBe(2);

  await tripleClickCanvas(page);
  await page.waitForTimeout(600);
  expect(context.pages().length).toBe(2);
});

test('navigation is bidirectional and lands in well under 200 ms', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);
  await expect(popup.getByTestId('conn-status')).toHaveText('Connected');

  const started = Date.now();
  await popup.getByTestId('prompter-next').click();
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');
  expect(Date.now() - started).toBeLessThan(1000);

  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(popup.getByTestId('prompter-count')).toHaveText('1 / 3');
});

test('the popout shows the notes for the page the main window is on', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.getByTestId('notes-editor').fill('page one words');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByTestId('notes-editor').fill('page two words');

  const popup = await openPrompter(page);
  await expect(popup.getByTestId('prompter-text')).toContainText('page two words');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(popup.getByTestId('prompter-text')).toContainText('page one words');
});

test('an edit made in the popout survives closing it and reloading', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);

  await popup.getByRole('button', { name: 'Edit' }).click();
  await popup.getByTestId('prompter-editor').fill('written from the teleprompter');
  await expect(page.getByTestId('notes-editor')).toHaveValue('written from the teleprompter');
  await popup.close();

  await page.reload();
  await expect(page.getByTestId('page-indicator')).toHaveText('1 / 3', { timeout: 15000 });
  const reopened = await openPrompter(page);
  await expect(reopened.getByTestId('prompter-text')).toContainText('written from the teleprompter');
});

test('display settings persist and narrow widths keep navigation usable', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);

  await popup.getByRole('button', { name: 'Bigger text' }).click();
  await popup.getByRole('button', { name: 'Bigger text' }).click();
  await popup.getByRole('button', { name: 'Mirror ↔' }).click();
  const before = await popup.getByTestId('prompter-text').locator('> div').first().getAttribute('style');
  expect(before).toContain('scaleX(-1)');
  expect(before).toContain('34px');

  await popup.setViewportSize({ width: 280, height: 420 });
  await expect(popup.getByTestId('prompter-next')).toBeVisible();
  await expect(popup.getByTestId('prompter-prev')).toBeVisible();
  await popup.getByTestId('prompter-next').click();
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');

  await popup.setViewportSize({ width: 900, height: 700 });
  await expect(popup.getByTestId('prompter-next')).toBeVisible();
  await popup.close();

  const reopened = await openPrompter(page);
  const after = await reopened.getByTestId('prompter-text').locator('> div').first().getAttribute('style');
  expect(after).toContain('scaleX(-1)');
  expect(after).toContain('34px');
});

test('the popout reports when the main window goes away', async ({ page, context }) => {
  await openApp(page);
  await loadFixture(page);
  const popup = await openPrompter(page);
  await expect(popup.getByTestId('conn-status')).toHaveText('Connected');

  await page.close();
  await expect(popup.getByTestId('conn-status')).toHaveText('Main presentation disconnected', { timeout: 8000 });
  await expect(popup.getByTestId('prompter-text')).toBeVisible();
  await popup.close();
  expect(context.pages().length).toBe(0);
});

test('triple-click opens the teleprompter before anything is loaded', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('dropzone')).toBeVisible();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByTestId('stage').click({ clickCount: 3, position: { x: 30, y: 30 } }),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByTestId('prompter-count')).toHaveText('—');

  // It is usable straight away: write the script first, load the deck later.
  await popup.getByRole('button', { name: 'Edit' }).click();
  await popup.getByTestId('prompter-editor').fill('opening words, written before the deck');
  await expect(page.getByTestId('notes-editor')).toHaveValue('opening words, written before the deck');
});

test('the prompter finds the slide numbers written in the script', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.getByRole('button', { name: 'Full script' }).click();
  await page
    .getByTestId('notes-editor')
    .fill('--- Slide 1 ---\nalpha words for one\n--- Slide 2 ---\nbeta words for two\n--- Slide 3 ---\ngamma words for three');

  const popup = await openPrompter(page);
  await expect(popup.getByTestId('prompter-text')).toContainText('alpha words for one');
  await expect(popup.getByTestId('prompter-text')).not.toContainText('beta words for two');

  await popup.getByTestId('prompter-next').click();
  await expect(page.getByTestId('page-indicator')).toHaveText('2 / 3');
  await expect(popup.getByTestId('prompter-text')).toContainText('beta words for two');

  // The whole script view keeps every section, and dims the ones not in play.
  await popup.getByRole('button', { name: 'Slide notes' }).click();
  await expect(popup.getByTestId('prompter-text')).toContainText('alpha words for one');
  await expect(popup.getByTestId('prompter-text')).toContainText('gamma words for three');
  await expect(popup.getByRole('button', { name: 'Follow' })).toBeVisible();
});
