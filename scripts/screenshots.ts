// SPDX-License-Identifier: GPL-3.0-or-later
// Captures the actual running game. Use a disposable server; this creates a pilot and a world.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.env.TEST_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: [
    '--no-sandbox',
    ...(process.env.SCREENSHOT_GPU === '1'
      ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
});
try {
  const page = await browser.newPage({
    viewport:
      process.env.SCREENSHOT_HERO_ONLY === '1'
        ? { width: 1280, height: 800 }
        : { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    (quality) => localStorage.setItem('aclone.quality', quality),
    process.env.SCREENSHOT_QUALITY ?? 'balanced',
  );
  mkdirSync('docs/screenshots', { recursive: true });
  await page.goto(base);
  console.log(
    'Graphics device',
    await page.locator('#viewport canvas').evaluate((c) => {
      const gl = (c as HTMLCanvasElement).getContext('webgl2')!;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    }),
  );
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Rowan ' + String(Date.now()).slice(-4));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('heading', { name: 'Somewhere to call home.' }).waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/galaxy.png' });
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Little Puddlewick');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await page.locator('#world-hud:not([hidden])').waitFor();
  await page.locator('#cash').filter({ hasText: '18s' }).waitFor();
  await page.waitForTimeout(5500);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: 'docs/screenshots/parish.png' });
  if (process.env.SCREENSHOT_HERO_ONLY === '1') {
    await page.keyboard.press('h');
    await page.mouse.move(700, 470);
    await page.mouse.down();
    await page.mouse.move(390, 470, { steps: 1 });
    await page.mouse.up();
    await page.mouse.wheel(0, -360);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: 'docs/screenshots/scenery.png' });
    console.log(
      'Renderer',
      await page.locator('#viewport canvas').evaluate((el) => ({ ...(el as HTMLElement).dataset })),
    );
  } else {
    const key = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
    const response = await page.request.get(base + '/api/session', {
      headers: { authorization: 'Bearer ' + key },
    });
    const pilot = (await response.json()).account.id;
    await page.locator('#chat-input').fill('*teleport ' + pilot + ' 24 45');
    await page.locator('#chat-input').press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('e');
    await page.getByRole('heading', { name: 'Flour mill', exact: true }).waitFor();
    await page.waitForTimeout(5500);
    await page.screenshot({ path: 'docs/screenshots/trading.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Editor F10' }).click();
    await page.getByRole('heading', { name: 'Your world. Your peculiar rules.' }).waitFor();
    await page.screenshot({ path: 'docs/screenshots/editor.png' });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Saved original gameplay screenshots in docs/screenshots/.');
} finally {
  await browser.close();
}
