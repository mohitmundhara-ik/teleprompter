import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIXTURES, expectPage, openApp, openPrompter } from './helpers';

test('a pptx loads every slide in order with its text', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('input[type=file]', join(FIXTURES, 'three-slides.pptx'));
  await expect(page.locator('.pptx-slide')).toBeVisible();
  await expect(page.getByTestId('canvas')).toContainText('Opening slide title');

  const popup = await openPrompter(page);
  await expectPage(popup, '1 / 3');
  await popup.getByTestId('prompter-next').click();
  await expect(page.getByTestId('canvas')).toContainText('Middle slide title');
  await popup.getByTestId('prompter-next').click();
  await expect(page.getByTestId('canvas')).toContainText('Closing slide title');
  await expectPage(popup, '3 / 3');

  // Slides are drawn at the deck's own dimensions, not reflowed as text.
  const box = await page.locator('.pptx-slide').boundingBox();
  expect(box!.width / box!.height).toBeGreaterThan(1.2);
});

test('video plays and pauses from the teleprompter', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('input[type=file]', join(FIXTURES, 'clip.webm'));
  const video = page.locator('video');
  await expect(video).toBeVisible();

  const popup = await openPrompter(page);
  await expect(popup.getByTestId('media-controls')).toBeVisible();

  await popup.getByRole('button', { name: 'Play' }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 5000 })
    .toBe(false);

  await popup.getByRole('button', { name: 'Pause' }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 5000 })
    .toBe(true);

  const before = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await popup.getByRole('button', { name: 'Forward ten seconds' }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 5000 })
    .toBeGreaterThan(before);
});

test('the slide window carries no message when the teleprompter is open', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('input[type=file]', join(FIXTURES, 'three-slides.pptx'));
  const popup = await openPrompter(page);

  // The PowerPoint fidelity notice belongs in the private window.
  await page.setInputFiles('input[type=file]', join(FIXTURES, 'three-slides.pptx'));
  await expect(popup.getByRole('status')).toContainText(/rebuilt in the browser/);
  await expect(page.getByRole('status')).toHaveCount(0);
});
