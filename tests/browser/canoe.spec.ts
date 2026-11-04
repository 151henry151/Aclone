// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('carry, set down, ownership, home storage, empty/failure states and portable canoe rules', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-canoe-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const owner = app.universe.register('Canoe maker'),
      other = app.universe.register('Canoe neighbour');
    const w = createWorld('canoe', 'Canoes', owner.account.id);
    w.script = '';
    w.buildings = [];
    w.roads = [];
    w.towns = [];
    Object.assign(w.settings, {
      mapSize: 500,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    const p = addPlayer(w, owner.account.id, owner.account.name),
      q = addPlayer(w, other.account.id, other.account.name);
    for (const person of [p, q])
      Object.assign(person, {
        x: 0,
        z: -40,
        y: 3,
        heading: 0,
        vehicle: 5,
        inventory: {},
        cash: 100000,
        speed: 0,
        engine: false,
      });
    q.x = 0;
    const carpenter = makeBuilding('carpenter', 'carpenter', 14, -40),
      home = makeBuilding('home', 'home', -14, -40);
    home.owner = p.id;
    w.buildings.push(carpenter, home);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        if (!localStorage.getItem('aclone.pilot')) localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'canoe');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token: owner.token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const panel = page.locator('.canoe-panel');
    await expect(panel).toContainText('No set-down canoe within reach');
    await expect(panel.getByRole('button', { name: /Craft canoe/ })).toBeDisabled();
    await panel.getByRole('button', { name: /Buy canoe/ }).click();
    await expect.poll(() => p.carrying).toBeTruthy();
    expect(p.cash).toBe(85000);
    await expect(panel).toContainText('Carrying a canoe overhead');
    // Let the action-result panel refresh finish before checking steady snapshot focus.
    await page.waitForTimeout(600);
    await panel.getByRole('button', { name: 'Set canoe down', exact: true }).focus();
    await page.waitForTimeout(600);
    await expect(panel.getByRole('button', { name: 'Set canoe down', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.mouse.move(650, 360);
    await page.mouse.down();
    await page.mouse.move(930, 400, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/canoe-overhead.png' });
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Set canoe down', exact: true }).click();
    await expect.poll(() => p.carrying).toBeUndefined();
    const id = Object.keys(w.smallCraft!)[0];
    expect(w.smallCraft![id].state).toBe('setDown');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/canoe-ground.png' });
    // A second authenticated player sees the same property and cannot take it.
    await page.evaluate((token) => localStorage.setItem('aclone.pilot', token), other.token);
    // Do not overwrite the selected identity on reload.
    const otherPage = await page.context().newPage();
    await otherPage.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(otherPage);
    await otherPage.keyboard.press('i');
    await expect(
      otherPage.locator('.canoe-panel').getByRole('button', { name: 'Owner-only pickup' }),
    ).toBeDisabled();
    await otherPage.screenshot({ path: 'test-results/canoe-owner-only.png' });
    await otherPage.close();
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Pick up canoe', exact: true }).click();
    await expect.poll(() => p.carrying).toBe(id);
    await panel.getByRole('button', { name: 'Store canoe at home', exact: true }).click();
    await expect.poll(() => home.stock.canoe).toBe(1);
    expect(Object.keys(w.smallCraft!)).toHaveLength(0);
    await panel.getByRole('button', { name: 'Take canoe out at the door', exact: true }).click();
    await expect.poll(() => p.carrying).toBeTruthy();
    home.stock.canoe = 2;
    await expect(panel).toContainText('Home canoe limit is full');
    await expect(
      panel.getByRole('button', { name: 'Store canoe at home', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: 'test-results/canoe-home-full.png' });
    home.stock.canoe = 0;
    await panel.getByRole('button', { name: 'Store canoe at home', exact: true }).click();
    await expect.poll(() => p.carrying).toBeUndefined();
    p.cash = 0;
    await expect(panel).toContainText('Not enough cash');
    await expect(panel.getByRole('button', { name: /Buy canoe/ })).toBeDisabled();
    await page.screenshot({ path: 'test-results/canoe-empty-and-poor.png' });
    p.inventory.wood = 8;
    await expect(panel.getByRole('button', { name: /Craft canoe/ })).toBeEnabled();
    await panel.getByRole('button', { name: /Craft canoe/ }).click();
    await expect.poll(() => p.carrying).toBeTruthy();
    expect(p.inventory.wood).toBe(0);
    expect(p.cash).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="canoeCarrySpeed"]').fill('0.3');
    await rules.locator('[name="canoeHomeLimit"]').fill('1');
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.canoeCarrySpeed).toBe(0.3);
    await rules.locator('[name="canoePrice"]').focus();
    await rules
      .getByRole('group', { name: 'Portable canoes', exact: true })
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'test-results/canoe-rules.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
