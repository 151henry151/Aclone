// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';

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
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
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
});
