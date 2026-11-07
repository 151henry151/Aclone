// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld } from '../../src/shared/simulation';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });

let app: Awaited<ReturnType<typeof createApp>>;
let dir: string;
let url: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aclone-entry-'));
  app = await createApp({ dataDir: dir, port: 0, dev: true });
  app.worlds.get('puddlewick')!.owner = 'host-steward';
  // A real player-created world with the same display name must not get the badge.
  app.worlds.set('community', createWorld('community', 'Puddlewick', 'another-pilot'));
  url = `http://127.0.0.1:${await app.listen()}`;
  mkdirSync('output/pilot-entry', { recursive: true });
});
test.afterAll(async () => {
  await app?.close();
  rmSync(dir, { recursive: true, force: true });
});
async function register(page: Page, name = 'New' + Date.now()) {
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
  await page.goto(url);
  await page.getByLabel('Pilot name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.getByRole('heading', { name: 'Somewhere to call home.' })).toBeVisible();
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`new pilot can land without scrolling at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Reverse directory order: the main world must not rely on insertion order.
    await page.route('**/api/galaxy', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.worlds.reverse();
      await route.fulfill({ response, json: body });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await register(page);
    const land = page.locator('[data-do="land"][data-id="puddlewick"]');
    // toBeVisible alone passes below the fold; measure before Playwright auto-scrolls.
    const box = await land.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const main = page.locator('.world-card').first();
    await expect(main).toContainText('Main world');
    await expect(main).toContainText('Recommended for new pilots');
    await expect(main.locator('[data-do="land"]')).toHaveAttribute('data-id', 'puddlewick');
    await expect(
      page.locator('.world-card').filter({ has: page.locator('[data-id="community"]') }),
    ).toContainText('Player-created world');
    const rules = main.locator('details');
    await expect(rules).not.toHaveAttribute('open', '');
    await rules.locator('summary').click();
    await expect(rules).toHaveAttribute('open', '');
    expect((await rules.innerText()).length).toBeGreaterThan(500);
    await rules.locator('summary').click();
    await page.locator('.galaxy-view').evaluate((e) => {
      e.scrollTop = 0;
    });
    expect(await page.locator('.galaxy-view').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `output/pilot-entry/entry-${viewport.width}.png` });
    await land.click();
    await waitForWorld(page);
    await expect(page.locator('#location')).toContainText('Puddlewick');
    expect(errors).toEqual([]);
  });
}
test('empty and unavailable directories explain the state without inventing a main world', async ({
  page,
}) => {
  await page.route('**/api/galaxy', (route) => route.fulfill({ json: { worlds: [] } }));
  await register(page);
  await expect(page.getByText('No worlds in this system yet.')).toBeVisible();
  await expect(page.locator('[data-do="land"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create a world' })).toBeVisible();
  await page.unroute('**/api/galaxy');
  await page.route('**/api/galaxy', (route) =>
    route.fulfill({ status: 503, json: { error: 'Directory unavailable' } }),
  );
  await page.reload();
  await expect(
    page.getByText(
      'The world directory could not be refreshed. Showing the last available worlds.',
    ),
  ).toBeVisible();
  await expect(page.locator('[data-do="land"][data-id="puddlewick"]')).toBeVisible();
});

test.describe('first-flight walkthrough', () => {
  test('join the standard main world from the compact directory', async ({ page }) => {
    app.worlds.delete('community');
    await register(page, 'Ada Turnip');
    await page.screenshot({ path: 'output/pilot-entry/welcome-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.pilot-card')).toBeHidden();
    await page.screenshot({ path: 'output/pilot-entry/welcome-phone.png' });
    await page.getByRole('button', { name: 'Land on this world' }).click();
    await waitForWorld(page);
    await expect(page.locator('#location')).toContainText('Puddlewick');
  });
});
