// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { waitForWorld } from './fixtures/ready';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
});

test('world creator opens the caretaker dashboard and reads residents and buildings', async ({
  page,
}) => {
  const name = 'Warden ' + Date.now().toString().slice(-6);
  await page.goto('./');
  await page.getByLabel('Pilot name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Books Parish');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await waitForWorld(page);
  await page.getByRole('button', { name: 'World F9' }).click();
  await page.getByRole('button', { name: 'Caretaker dashboard', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Caretaker dashboard.' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('PILOTS', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(dialog).toContainText('Books Parish');
  await dialog.getByRole('button', { name: 'Residents', exact: true }).click();
  await expect(dialog.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await expect(dialog).toContainText('Hunger');
  await expect(dialog).toContainText('Activity log');
  await dialog.getByRole('button', { name: 'Buildings', exact: true }).click();
  await dialog.getByRole('button', { name: /Odd Jobs Office/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Odd Jobs Office' })).toBeVisible();
  await expect(dialog).toContainText('Stock:');
  await expect(dialog).toContainText('TILL');
  await dialog.getByRole('button', { name: 'Ledger', exact: true }).click();
  await expect(dialog).toContainText('starting cash');
  await dialog.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(dialog.getByLabel('Notice history')).toContainText('Welcome to Books Parish');
  let requests = 0;
  await page.route('**/api/caretaker/**?kind=chat*', async (route) => {
    requests++;
    const older = new URL(route.request().url()).searchParams.has('before');
    await route.fulfill({
      json: {
        entries: Array.from({ length: older ? 2 : 100 }, (_, i) => ({
          id: older ? 2 - i : 102 - i,
          time: i,
          name: 'Neighbour',
          text: older ? `Old message ${i}` : `Public message ${i}`,
          kind: 'chat',
          npc: false,
        })),
        ...(older ? {} : { before: 3 }),
      },
    });
  });
  await dialog.getByRole('button', { name: 'Chat logs', exact: true }).click();
  const history = dialog.getByLabel('Public chat history');
  await expect(history.locator('li')).toHaveCount(100);
  await history.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => history.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  const position = await history.evaluate((el) => el.scrollTop);
  // The live dashboard refreshes every four seconds; archive reading must stay put.
  await page.waitForTimeout(4500);
  expect(await history.evaluate((el) => el.scrollTop)).toBeCloseTo(position, 0);
  expect(requests).toBe(1);
  await history.getByRole('button', { name: 'Load older entries' }).click();
  await expect(history.locator('li')).toHaveCount(102);
  await expect(history).toContainText('Old message 1');
  await expect(history).toContainText('Beginning of available history');
  expect(requests).toBe(2);
});
