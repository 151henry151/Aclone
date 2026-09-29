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
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
  mkdirSync('docs/screenshots', { recursive: true });
  await page.goto(base);
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
  await page.waitForTimeout(5500);
  await page.screenshot({ path: 'docs/screenshots/parish.png' });
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
  console.log('Saved original gameplay screenshots in docs/screenshots/.');
} finally {
  await browser.close();
}
