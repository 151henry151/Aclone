// SPDX-License-Identifier: GPL-3.0-or-later
// Actual in-game character captures. Use a disposable server: creates a pilot and world.
import { chromium, expect } from '@playwright/test';
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'high'));
  await page.goto(base);
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Character ' + Date.now().toString().slice(-7));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Character review');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Inventory I', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to walking' }).click();
  await expect(page.locator('#driving')).toContainText('On foot');
  await page.keyboard.press('h');
  await page.mouse.move(410, 490);
  await page.mouse.down();
  await page.mouse.move(825, 490);
  await page.mouse.up();
  await page.mouse.wheel(0, -450);
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/character.png' });
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/walking.png' });
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('h');
  await page.getByRole('button', { name: 'Inventory I', exact: true }).click();
  await page.getByRole('button', { name: 'Return to tractor' }).click();
  await expect(page.locator('#driving')).toContainText('Puddle tractor');
  await page.keyboard.press('h');
  await page.mouse.move(720, 490);
  await page.mouse.down();
  await page.mouse.move(815, 490);
  await page.mouse.up();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  await page.screenshot({ path: 'docs/screenshots/driver.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved walking character and seated driver gameplay captures.');
} finally {
  await browser.close();
}
