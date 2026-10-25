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
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
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
  await page.goto(url + '/buildings');
  await expect(page).toHaveURL(url + '/buildings/');
  await expect(page.locator('article')).toHaveCount(49);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await page.getByLabel('Find a building').fill('brewery');
  await expect(page.locator('article:visible')).toHaveCount(1);
  await expect(page.locator('#results')).toHaveText('1 of 49 building types');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: `${output}/buildings-mobile.png`, fullPage: true });
  await page.getByLabel('Find a building').fill('does not exist');
  await expect(page.locator('article:visible')).toHaveCount(0);
  await expect(page.locator('#results')).toContainText('No matching buildings');
  await page.getByLabel('Find a building').fill('');
  await page.evaluate(async () => {
    for (const image of document.images) {
      image.loading = 'eager';
      await image.decode();
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${output}/buildings-desktop.png` });
  // Renderer stays off the page until requested.
  expect(await page.locator('canvas').count()).toBe(0);
  const openHome = page.locator('#home .image-link');
  await openHome.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  const preview = page.locator('#building-preview');
  await expect(dialog).toBeVisible();
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const canvas = preview.locator('canvas');
  const before = await canvas.screenshot();
  await preview.focus();
  await page.keyboard.press('ArrowLeft');
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  const rotated = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  expect(Buffer.compare(rotated, await canvas.screenshot())).not.toBe(0);
  await page.getByLabel('Surface finish', { exact: true }).selectOption('brick-workshop');
  await expect(preview).toHaveAttribute('data-ready', 'true');
  const brick = await canvas.screenshot();
  await page.getByLabel('Surface finish', { exact: true }).selectOption('metal-panel');
  await expect(preview).toHaveAttribute('data-ready', 'true');
  expect(Buffer.compare(brick, await canvas.screenshot())).not.toBe(0);
  const scale = await canvas.getAttribute('data-metres-per-pixel');
  await page.getByLabel('Building size', { exact: true }).selectOption('large');
  await page.getByLabel('Architectural model', { exact: true }).selectOption('model-5');
  await expect(preview).toHaveAttribute('data-ready', 'true');
  expect(await canvas.getAttribute('data-metres-per-pixel')).toBe(scale);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.screenshot({ path: `${output}/building-viewer-desktop.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(openHome).toBeFocused();
  await expect(preview.locator('canvas')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#pickup .image-link').click();
  await expect(preview).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Paint colour')).toBeVisible();
  await page.getByLabel('Paint colour').selectOption('ocean-blue');
  await expect(page.getByLabel('Building size', { exact: true })).toBeDisabled();
  await page.screenshot({ path: `${output}/building-viewer-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
  await page.getByRole('button', { name: 'Close building preview' }).click();
  // All building types load through the same public viewer with no missing textures.
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const link of await page.locator('[data-preview]').all()) {
    await link.click();
    await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
    await expect(page.locator('#preview-status')).not.toContainText('could not load');
    await expect(
      page.getByLabel('Architectural model', { exact: true }).locator('option'),
    ).toHaveCount(5);
    if ((await link.getAttribute('data-preview')) === 'starport') {
      await page.screenshot({ path: `${output}/building-viewer-starport.png` });
      const terminalScale = await canvas.getAttribute('data-metres-per-pixel');
      await page.getByLabel('Include launch pad and rocket').check();
      await expect(preview).toHaveAttribute('data-ready', 'true');
      expect(Number(await canvas.getAttribute('data-metres-per-pixel'))).toBeGreaterThan(
        Number(terminalScale),
      );
      await page.getByLabel('Include launch pad and rocket').uncheck();
      expect(await canvas.getAttribute('data-metres-per-pixel')).toBe(terminalScale);
    }
    await page.keyboard.press('Escape');
  }
  // Exercise real touch input, not just a narrow desktop viewport.
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto(url + '/buildings/');
  await phone.locator('#bakery .image-link').tap();
  await expect(phone.locator('#building-preview')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  const phoneCanvas = phone.locator('#building-preview canvas');
  const initialTouchView = await phoneCanvas.screenshot();
  const touchBox = (await phoneCanvas.boundingBox())!;
  const cdp = await phone.context().newCDPSession(phone);
  const touch = (x: number) => [{ x, y: touchBox.y + touchBox.height / 2, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touch(touchBox.x + 80),
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: touch(touchBox.x + 180),
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Buffer.compare(initialTouchView, await phoneCanvas.screenshot())).not.toBe(0);
  await phone.getByLabel('Surface finish', { exact: true }).selectOption('brick-workshop');
  await phone.getByRole('button', { name: 'Close building preview' }).tap();
  await expect(phone.getByRole('dialog')).not.toBeVisible();
  await phone.close();
  // Closing during a slow module download must not resurrect the preview.
  const delayed = await browser.newPage();
  let releaseModule!: () => void;
  const gate = new Promise<void>((done) => (releaseModule = done));
  await delayed.route('**/building-viewer/viewer.js', async (route) => {
    await gate;
    await route.continue();
  });
  await delayed.goto(url + '/buildings/');
  await delayed.locator('#home .image-link').click();
  await expect(delayed.locator('#preview-status')).toContainText('Loading');
  await delayed.keyboard.press('Escape');
  releaseModule();
  await delayed.waitForResponse('**/building-viewer/viewer.js');
  await expect(delayed.getByRole('dialog')).not.toBeVisible();
  await expect(delayed.locator('canvas')).toHaveCount(0);
  await delayed.locator('#bakery .image-link').click();
  await expect(delayed.locator('#building-preview')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  await delayed.close();
  // WebGL failure retains the image sheet and a usable close control.
  const noGL = await browser.newPage();
  await noGL.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.includes('webgl')) return null;
      return (original as any).call(this, type, ...args);
    } as typeof original;
  });
  await noGL.goto(url + '/buildings/');
  await noGL.locator('#home .image-link').click();
  await expect(noGL.locator('#preview-status')).toContainText('3D preview unavailable', {
    timeout: 60000,
  });
  await expect(noGL.locator('#preview-sheet')).toHaveAttribute('href', /home.webp$/);
  await noGL.keyboard.press('Escape');
  await expect(noGL.getByRole('dialog')).not.toBeVisible();
  await noGL.close();
  await plain.goto(url + '/buildings/#home');
  await expect(plain.locator('article')).toHaveCount(49);
  await expect(plain.locator('.filter')).toBeHidden();
  await expect(plain.locator('#home')).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'PASS: 4 screen widths, images, navigation, keyboard lightbox/focus, FAQ, anchors, 49-building gallery/search/interactive previews, rotation, finishes, fixed scale, focus restoration and WebGL/no-JavaScript fallbacks.',
  );
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}
