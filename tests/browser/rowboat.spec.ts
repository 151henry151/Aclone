// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../../src/server/puddlewick-boatyard';
import { boatLandings } from '../../src/shared/boathouse';
import { rowboatBeach } from '../../src/shared/rowboat-shore';
import { surfaceWaterLevel } from '../../src/shared/ocean';
import { travelHeight } from '../../src/shared/dock';
import { waitForWorld } from './fixtures/ready';

test('buy a rowboat, row, beach, inspect its mooring, reboard and edit its world rules', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-rowboat-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Rowboat skipper');
  const w = createWorld('puddlewick', 'Rowboats on the bay', account.id);
  w.script = '';
  ensurePuddlewickBoatyard(w);
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    tidalRange: 0,
    vehicleLicences: false,
    parishOrders: false,
  });
  const yard = boatLandings(w).find((d) => d.building)!,
    pier = boatLandings(w).find((d) => !d.building && !d.river && !d.quay)!;
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, yard.land, {
    y: travelHeight(w, yard.land.x, yard.land.z),
    vehicle: 5,
    inventory: { stone: 16 },
    cash: 1000000,
  });
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!,
    me = () => current().players[p.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const port = await app.listen();
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'normal');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const buy = page.getByRole('button', { name: /Buy and board Rowboat/ });
    await expect(buy).toBeDisabled();
    await expect(buy).toHaveAttribute('title', /Carrying 32 weight.*holds 30/);
    expect(me().vehicle).toBe(5);
    me().inventory = {};
    await buy.click();
    await expect.poll(() => me().vehicle).toBe(36);
    await expect(page.getByText('Launch emergency lifeboat', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).not.toContainText('To refuel, carry Fuel aboard');
    await expect(page.getByRole('dialog')).not.toContainText('the boat still stops and recoils');
    await expect(page.getByRole('dialog')).toContainText('This rowboat needs no fuel');
    await close();
    const start = { x: me().x, z: me().z };
    await page.keyboard.down('w');
    await expect.poll(() => Math.hypot(me().x - start.x, me().z - start.z)).toBeGreaterThan(4);
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    // Set up an approach on the actual sandy bay, then use ordinary UI to moor.
    let shore: ReturnType<typeof rowboatBeach>;
    const probe = { ...me(), vehicle: 36, speed: 0, heading: Math.PI / 2 };
    for (let x = -170; x <= -80 && !shore; x += 2)
      for (let z = 150; z <= 190; z += 0.2) {
        Object.assign(probe, { x, z });
        shore = rowboatBeach(current(), probe);
        if (shore) break;
      }
    expect(shore).toBeDefined();
    Object.assign(me(), shore!.berth, {
      heading: shore!.heading,
      y: surfaceWaterLevel(current(), shore!.berth.x, shore!.berth.z),
      speed: 0,
    });
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(5);
    expect(current().mooredBoats![`${p.id}:36`].beached).toBeDefined();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.keyboard.press('h');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.mouse.wheel(0, -180);
    await page.screenshot({ path: 'output/rowboats/beached-rowboat.png' });
    const visitor = app.universe.register('Bank visitor');
    const observer = addPlayer(current(), visitor.account.id, visitor.account.name);
    Object.assign(observer, {
      x: me().x,
      z: me().z,
      y: me().y,
      heading: me().heading,
      vehicle: 5,
      inventory: {},
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const view = await context.newPage();
    view.on('pageerror', (e) => errors.push(e.message));
    await view.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'normal');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token: visitor.token, world: w.id },
    );
    await view.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(view);
    await view.keyboard.press('i');
    await expect(
      view.getByText('This beached rowboat belongs to another player.', { exact: true }),
    ).toBeVisible();
    await expect(
      view.getByRole('button', { name: 'Take beached rowboat', exact: true }),
    ).toHaveCount(0);
    await expect(view.getByRole('button', { name: /Buy and board Rowboat/ })).toHaveCount(0);
    await view.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await view.keyboard.press('h');
    await expect(view.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(view.locator('#toast')).toHaveCSS('opacity', '0');
    await view.mouse.wheel(0, -180);
    await view.screenshot({ path: 'output/rowboats/rowboat-from-another-player.png' });
    current().players[observer.id].x -= 20;
    await context.close();

    await page.keyboard.press('h');
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Board your Rowboat', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(36);
    expect(current().mooredBoats![`${p.id}:36`]).toBeUndefined();
    await close();
    Object.assign(me(), {
      x: 0,
      z: 320,
      y: surfaceWaterLevel(current(), 0, 320),
      heading: 0.5,
      speed: 0,
    });
    await page.keyboard.press('i');
    await expect(page.getByRole('button', { name: 'Disembark on foot', exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('[data-marine-safety]')).toBeVisible();
    await close();
    await page.keyboard.down('w');
    await expect.poll(() => me().speed).toBeGreaterThan(1);
    await page.keyboard.press('h');
    await page.mouse.wheel(0, -850);
    await page.mouse.move(720, 400);
    await page.mouse.down();
    await page.mouse.move(920, 400, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await expect.poll(() => me().speed).toBeGreaterThan(1);
    await page.screenshot({ path: 'output/rowboats/rowing-on-the-bay.png' });
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    await page.keyboard.press('h');
    // Verify purchase at the actual fishing pier with a fresh local player's fleet.
    Object.assign(me(), pier.land, {
      vehicle: 5,
      fleet: [0, 5],
      speed: 0,
      y: travelHeight(current(), pier.land.x, pier.land.z),
    });
    await page.keyboard.press('i');
    await page.getByRole('button', { name: /Buy and board Rowboat/ }).click();
    await expect.poll(() => me().vehicle).toBe(36);
    await close();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.getByRole('group', { name: 'Rowboats', exact: true });
    await rules.locator('[name="rowboatStepOutDepth"]').fill('1.1');
    await rules.locator('[name="rowboatsEnabled"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.rowboatStepOutDepth).toBe(1.1);
    expect(current().settings.rowboatsEnabled).toBe(false);
    await close();
    Object.assign(me(), pier.land, {
      vehicle: 5,
      fleet: [0, 5],
      speed: 0,
      y: travelHeight(current(), pier.land.x, pier.land.z),
    });
    await page.keyboard.press('i');
    await expect(page.getByRole('button', { name: /Buy and board Rowboat/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
