// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('tug rules quote local fees and retain escrow through cash refusal cancellation and expiry', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-towing-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let guestContext: BrowserContext | undefined;
  try {
    const tug = app.universe.register('Tug'),
      guest = app.universe.register('Captain');
    const initial = createWorld('puddlewick', 'Tug rules', tug.account.id);
    initial.script = '';
    Object.assign(initial.settings, {
      vehicleLicences: false,
      requireCaptainSkill: false,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    const t0 = addPlayer(initial, tug.account.id, 'Tug');
    Object.assign(t0, {
      vehicle: 32,
      fleet: [0, 5, 32],
      fuel: 512,
      fuelVehicle: 32,
      x: 0,
      z: 1040,
      y: 0,
      speed: 0,
      engine: false,
      cash: 10000,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      t = () => w().players[tug.account.id],
      c = () => w().players[guest.account.id];
    const port = await app.listen();
    const login = async (target: typeof page, token: string) => {
      await target.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'puddlewick');
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token },
      );
      await target.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(target);
    };
    await login(page, tug.token);
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Tug rescue offers', exact: true }),
      patch = { towDefaultFee: 1234, towMaximumFee: 2000, towOfferSeconds: 60 };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.towDefaultFee).toBe(1234);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/tug-rules.png' });
    await close();
    await page.keyboard.press('i');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('No other stranded captains');
    await expect(async () => {
      const empty = dialog.getByText('No other stranded captains are currently available.', {
        exact: true,
      });
      await empty.scrollIntoViewIfNeeded();
      await expect(empty).toBeInViewport();
    }).toPass({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/tug-empty.png' });
    const c0 = addPlayer(w(), guest.account.id, 'Captain');
    Object.assign(c0, {
      online: true,
      vehicle: 30,
      fleet: [0, 5, 30],
      fuel: 0,
      fuelVehicle: 30,
      x: 0,
      z: 1000,
      y: 0,
      speed: 0,
      engine: false,
      cash: 1000,
      inventory: { cod: 10 },
    });
    guestContext = await page.context().browser()!.newContext();
    const other = await guestContext.newPage();
    other.on('pageerror', (e) => errors.push(e.message));
    other.setDefaultTimeout(15000);
    await login(other, guest.token);
    await other.keyboard.press('i');
    const fee = dialog.locator('[name="feeDenarii"]');
    await expect(fee).toHaveValue('12.34');
    await expect(fee).toHaveAttribute('max', '20');
    await dialog.getByRole('button', { name: 'Offer tow', exact: true }).click();
    await expect.poll(() => w().towJobs?.[c().id]?.fee).toBe(1234);
    await other.getByRole('button', { name: 'Accept rescue fee', exact: true }).click();
    await expect(other.locator('#toast')).toContainText('Not enough cash');
    expect(c().cash).toBe(1000);
    expect(w().towJobs![c().id].state).toBe('offered');
    await expect(other.locator('#toast')).toHaveCSS('opacity', '1');
    await other.screenshot({ path: 'test-results/tug-cash-failure.png' });
    await dialog.getByRole('button', { name: 'Cancel agreement', exact: true }).click();
    await expect.poll(() => w().towJobs?.[c().id]).toBeUndefined();
    await fee.fill('10');
    await dialog.getByRole('button', { name: 'Offer tow', exact: true }).click();
    await expect.poll(() => w().towJobs?.[c().id]?.fee).toBe(1000);
    await expect(other.getByRole('dialog')).toContainText('10.00d · offered');
    const tugCash = t().cash;
    await other.getByRole('button', { name: 'Accept rescue fee', exact: true }).click();
    await expect.poll(() => w().towJobs?.[c().id]?.state).toBe('accepted');
    expect(c().cash).toBe(0);
    expect(t().cash).toBe(tugCash);
    await expect(other.getByRole('dialog')).toContainText('10.00d · accepted');
    await other.screenshot({ path: 'test-results/tug-held-fee.png' });
    await dialog.getByRole('button', { name: 'Cancel agreement', exact: true }).click();
    await expect.poll(() => c().cash).toBe(1000);
    expect(t().cash).toBe(tugCash);
    await expect(dialog.getByRole('button', { name: 'Cancel agreement', exact: true })).toHaveCount(
      0,
    );
    await dialog.getByRole('button', { name: 'Offer tow', exact: true }).click();
    await expect.poll(() => w().towJobs?.[c().id]?.state).toBe('offered');
    w().time += 61;
    await expect.poll(() => w().towJobs?.[c().id]).toBeUndefined();
    await expect(other.getByRole('button', { name: 'Accept rescue fee', exact: true })).toHaveCount(
      0,
    );
    expect(c().cash).toBe(1000);
    expect(t().cash).toBe(tugCash);
    await dialog.getByRole('button', { name: 'Offer tow', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'test-results/tug-expired.png' });
    expect(errors).toEqual([]);
  } finally {
    await guestContext?.close();
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
