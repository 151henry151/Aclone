// SPDX-License-Identifier: GPL-3.0-or-later
// Responsive, keyboard and progressive-enhancement checks against the built public site.
import './build-website.ts';
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { serveWebsite } from './serve-website.ts';
const server = await serveWebsite(0);
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const output = 'test-results/website';
mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A little world.');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      for (const image of document.images)
        if (image.getAttribute('src')) {
          image.loading = 'eager';
          await image.decode();
        }
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow, `No horizontal overflow at ${width}px`).toBe(false);
    await expect(page.getByRole('link', { name: 'Play free' })).toBeVisible();
    await page.getByRole('link', { name: 'Create worlds', exact: true }).click();
    expect(await page.evaluate(() => location.hash)).toBe('#create');
    await page.getByRole('link', { name: 'Host a galaxy', exact: true }).click();
    expect(await page.evaluate(() => location.hash)).toBe('#host');
    await page.getByRole('link', { name: 'First steps', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Make a home.' })).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: `${output}/${width === 1440 ? 'desktop' : 'mobile'}-hero.png`,
      });
      await page.screenshot({
        path: `${output}/${width === 1440 ? 'desktop' : 'mobile'}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const shot = page.locator('[data-gallery]').first();
  await shot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(shot).toBeFocused();
  await page.getByText('What happens when I log off?', { exact: true }).click();
  await expect(page.locator('details[open]')).toContainText('starvation continue offline');
  for (const a of await page.locator('a[href^="#"]').all()) {
    const id = (await a.getAttribute('href'))!.slice(1);
    expect(await page.locator(`[id="${id}"]`).count(), `anchor #${id}`).toBe(1);
  }
  expect(await page.locator('a[href="/aclone/"]').count()).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
  const plain = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await plain.goto(url);
  await expect(plain.getByRole('link', { name: 'Play free' })).toBeVisible();
  await plain.getByText('Is it really free?', { exact: true }).click();
  await expect(plain.locator('details[open]')).toContainText('GPL');
  await expect(plain.locator('[data-gallery]').first()).toHaveAttribute('href', /\.webp$/);
  console.log(
    'PASS: 4 screen widths, image loading, navigation, keyboard lightbox/focus, FAQ, anchors and no-JavaScript fallback.',
  );
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}
