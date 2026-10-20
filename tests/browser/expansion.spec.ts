// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { waitForWorld } from './fixtures/ready';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
});
test('galaxy contracts, surveys, station quotes and route map work through the browser', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Space ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.getByRole('img', { name: /Galaxy map/ })).toBeVisible();
  await page.getByRole('button', { name: 'Shipyard & space trade' }).click();
  await page.getByRole('button', { name: 'Survey this system' }).click();
  await expect(page.getByRole('button', { name: 'Survey this system' })).toBeDisabled();
  await page.getByRole('button', { name: 'Accept delivery contract' }).click();
  await expect(page.getByRole('dialog')).toContainText('Ten sealed packages to Loam');
  await expect(page.locator('select[name="item"]')).toContainText('station 200');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: /^Loam ·/ }).click();
  await expect(page.locator('.eyebrow').filter({ hasText: 'GALACTIC DIRECTORY' })).toContainText(
    'LOAM',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Shipyard & space trade' }).click();
  await page.getByRole('button', { name: 'Deliver contract' }).click();
  await expect(page.getByRole('button', { name: 'Accept delivery contract' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Shipyard & space trade' }).click();
  await expect(page.getByRole('dialog')).toContainText('93 galactic credits');
  expect(errors).toEqual([]);
});
test('cottage styles, garage paint and combat choices survive real server actions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Stylist ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Expansion browser');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await waitForWorld(page);
  const key = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
  const response = await page.request.get('./api/session', {
    headers: { authorization: 'Bearer ' + key },
  });
  const id = (await response.json()).account.id;
  const command = async (text: string) => {
    await page.locator('#chat-input').fill(text);
    await page.locator('#chat-input').press('Enter');
  };
  await command(`*teleport ${id} -118 8`);
  await expect(page.locator('#target')).toContainText('Spanner & Sons');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Harbour blue', exact: true }).click();
  // The current colour is hidden; only alternative paint choices are actionable.
  await expect(page.locator('[data-do="paint"][data-id="blue"]')).toBeHidden();
  await expect(page.locator('[data-do="paint"]:visible').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByLabel('Building type', { exact: true }).selectOption('home');
  const finish = page.getByLabel('Surface finish', { exact: true });
  await expect(finish.locator('option')).toHaveCount(6);
  await finish.selectOption('red-timber');
  await page.getByLabel('Architectural model', { exact: true }).selectOption('model-2');
  await expect(page.locator('[data-build-preview] canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(finish).toHaveValue('red-timber');
  await expect(page.getByLabel('Architectural model', { exact: true })).toHaveValue('model-2');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await command('*fighting 1');
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.getByRole('button', { name: 'Capture the flag', exact: true }).click();
  await expect(page.locator('#objective')).toContainText('ctf');
  await page.keyboard.press('1');
  await page.keyboard.press('Tab');
  await page.reload();
  await expect(page.locator('#objective')).toContainText('ctf');
  expect(errors).toEqual([]);
});
