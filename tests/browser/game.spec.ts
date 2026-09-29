// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
});
test('pilot registration, galaxy, landing, movement and persistent recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/welcome.png' });
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Browser ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.getByRole('heading', { name: 'Somewhere to call home.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/galaxy.png' });
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#cash')).toHaveText('18s 0d');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/parish.png' });
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1800);
  await expect(page.locator('#driving')).not.toContainText(/^0 MPH/);
  await page.keyboard.up('ArrowDown');
  await page.getByRole('button', { name: 'World F9' }).click();
  await page.getByRole('button', { name: 'Return to town centre' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.getByRole('button', { name: 'Join Hornball' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#clock')).toContainText('RUST 0 : 0 MOSS');
  await page.getByRole('button', { name: 'Parp Space' }).click();
  await page.reload();
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#clock')).toContainText('RUST');
  expect(errors).toEqual([]);
});
test('world creation, owner editor, safe Lua and live terrain changes', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Builder ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Browser Parish');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.getByRole('button', { name: 'Editor F10' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your world. Your peculiar rules.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Landscape', exact: true }).click();
  await page.getByRole('button', { name: 'Apply terrain brush' }).click();
  await expect(page.locator('#toast')).toContainText('Done');
  await page.getByRole('button', { name: 'Script', exact: true }).click();
  await page
    .getByLabel('World script', { exact: true })
    .fill('on("ScriptReload", function(e) announce("It works.") end)');
  await page.getByRole('button', { name: 'Validate & reload Lua' }).click();
  await expect(page.locator('#toast')).toContainText('Script validated');
  await page.screenshot({ path: 'test-results/editor.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const key = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
  const session = await page.request.get('/api/session', {
    headers: { authorization: 'Bearer ' + key },
  });
  const identity = (await session.json()).account.id;
  await page.locator('#chat-input').fill('*teleport ' + identity + ' 0 -28');
  await page.locator('#chat-input').press('Enter');
  await expect(page.locator('#target')).toContainText('Odd Jobs Office');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Work a shift · 45d' }).click();
  await expect(page.locator('#target')).toContainText('LABOUR');
  await expect(page.locator('#cash')).toHaveText('18s 45d', { timeout: 22000 });
});
test('small viewport can register and navigate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Mobile ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
});
