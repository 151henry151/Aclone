// SPDX-License-Identifier: GPL-3.0-or-later
// Real village views from a disposable world, for scale and building-silhouette review.
import { chromium, expect } from '@playwright/test';
const base = (process.env.TEST_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
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
    .fill('Scale ' + Date.now().toString().slice(-7));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Village scale review');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  const key = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
  const session = await page.request.get(base + '/api/session', {
    headers: { authorization: 'Bearer ' + key },
  });
  const id = (await session.json()).account.id;
  await page.mouse.move(720, 500);
  await page.mouse.wheel(0, -280);
  // Front elevations approached through normal world-owner teleport commands.
  for (const [name, x, z] of [
    ['village', 0, 17],
    ['cottage', -78, 121],
    ['pub', 105, 7],
    ['mill', 45, 118],
    ['shops', -65, -42],
    ['school', 68, -69],
  ] as const) {
    await page.locator('#chat-input').fill(`*teleport ${id} ${x} ${z}`);
    await page.locator('#chat-input').press('Enter');
    await page.keyboard.press('h');
    await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `docs/screenshots/${name}.png` });
    await page.keyboard.press('h');
  }
  await page.mouse.wheel(0, 280);
  await page.getByRole('button', { name: 'Inventory I', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to walking' }).click();
  await page.locator('#chat-input').fill(`*teleport ${id} -78 115`);
  await page.locator('#chat-input').press('Enter');
  await page.keyboard.press('h');
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/human-scale.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved village, cottage, pub, mill, shops, school and human-scale gameplay views.');
} finally {
  await browser.close();
}
