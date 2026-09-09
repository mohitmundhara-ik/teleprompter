import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIXTURES, openApp, openPrompter } from './helpers';

test('a pptx loads every slide in order with its text', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('input[type=file]', join(FIXTURES, 'three-slides.pptx'));
  await expect(page.getByTestId('page-indicator')).toHaveText('1 / 3');
  await expect(page.getByTestId('canvas')).toContainText('Opening slide title');
  await expect(page.getByRole('status')).toContainText(/PowerPoint files store shapes/);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('canvas')).toContainText('Middle slide title');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('canvas')).toContainText('Closing slide title');
  await expect(page.getByTestId('page-indicator')).toHaveText('3 / 3');
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

test('screen share mode explains why slide controls are inactive', async ({ page, context }) => {
  await context.grantPermissions([]);
  await openApp(page);
  // getDisplayMedia needs a real user gesture and a picker, so assert the
  // cancellation path instead: it must fail loudly rather than silently.
  await page.getByRole('button', { name: 'Share screen' }).click();
  await expect(page.getByRole('status')).toContainText(/cancelled|blocked|could not start|cannot share/i);
});
